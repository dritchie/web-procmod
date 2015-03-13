var Geo = (function() {

	var Geo = {}

	// ------------------------------------------------------------------------

	// Small, bare-bones geometry object
	Geo.Geometry = function()
	{
		this.vertices = [];
		this.normals = [];
		this.uvs = [];
		this.indices = [];
		this.bbox = null;
	}

	Geo.Geometry.prototype = {

		constructor: Geo.Geometry,

		merge: function(other)
		{
			var nverts = this.vertices.length;
			var nnorms = this.normals.length;
			var nuvs = this.uvs.length;
			for (var i = 0; i < other.vertices.length; i++)
				this.vertices.push(other.vertices[i].clone());
			for (var i = 0; i < other.normals.length; i++)
				this.normals.push(other.normals[i].clone());
			for (var i = 0; i < other.uvs.length; i++)
				this.uvs.push(other.uvs[i].clone());
			for (var i = 0; i < other.indices.length; i++)
			{
				var oidx = other.indices[i];
				this.indices.push({vertex: oidx.vertex + nverts, normal: oidx.normal + nnorms, uv: oidx.uv + nuvs});
			}
		},

		clone: function()
		{
			var ngeo = new Geo.Geometry();
			ngeo.merge(this);
			return ngeo;
		},

		combine: function(other)
		{
			var ngeo = this.clone();
			ngeo.merge(other);
			return ngeo;
		},

		clear: function()
		{
			Geo.Geometry.call(this);
		},

		// Computes this.bbox only if it's null
		// Otherwise, return the cached value
		getbbox: function()
		{
			if (this.bbox == null)
				this.updatebbox();
			return this.bbox;
		},

		// Forcibly recomputes this.bbox
		updatebbox: function()
		{
			if (this.bbox === null)
				this.bbox = new THREE.Box3();
			this.bbox.setFromPoints(this.vertices);
			return this.bbox;
		},

		toThreeGeo: function()
		{
			var threegeo = new THREE.Geometry();
			// Copy vertices
			for (var i = 0; i < this.vertices.length; i++)
				threegeo.vertices.push(this.vertices[i].clone());
			// Prep UVs for copy, if we have any
			if (this.uvs.length > 0)
			{
				for (var i = 0; i < this.vertices.length; i++)
					threegeo.faceVertexUVs[0].push(new THREE.Vector2());
			}
			// Copy faces, normals, and UVs
			for (var i = 0; i < this.indices.length/3; i++)
			{
				var i0 = this.indices[3*i];
				var i1 = this.indices[3*i + 1];
				var i2 = this.indices[3*i + 2];
				// Faces, normals
				var face = new THREE.Face3(
					i0.vertex, i1.vertex, i2.vertex,
					this.normals[i0.normal].clone(),
					this.normals[i1.normal].clone(),
					this.normals[i2.normal].clone()
				)
				threegeo.faces.push(face);
				// UVs
				if (this.uvs.length > 0)
				{
					threegeo.UVs[i0.vertex].copy(this.uvs[i0.uv]);
					threegeo.UVs[i1.vertex].copy(this.uvs[i1.uv]);
					threegeo.UVs[i2.vertex].copy(this.uvs[i2.uv]);
				}
			}
			return threegeo;
		},

		// Assumes no UVs (just vertices and normals)
		fromThreeGeo: function(threegeo)
		{
			this.clear();
			// Copy vertices
			// Prep normals (we'll just grab vertexNormals per face)
			for (var i = 0; i < threegeo.vertices.length; i++)
			{
				this.vertices.push(threegeo.vertices[i].clone());
				this.normals.push(new THREE.Vector3());
			}
			// Copy faces and normals
			for (var i = 0; i < threegeo.faces.length; i++)
			{
				var f = threegeo.faces[i];
				this.normals[f.a].copy(f.vertexNormals[0]);
				this.normals[f.b].copy(f.vertexNormals[1]);
				this.normals[f.c].copy(f.vertexNormals[2]);
				this.indices.push({vertex: f.a, normal: f.a, uv: -1});
				this.indices.push({vertex: f.b, normal: f.b, uv: -1});
				this.indices.push({vertex: f.c, normal: f.c, uv: -1});
			}
		}
	}

	// Voxelization stuff

	var vzero = new THREE.Vector3(0, 0, 0);

	var voxelizeTriangle = (function() {
		var vmin = new THREE.Vector3();
		var vmax = new THREE.Vector3();
		return function(outgrid, v0, v1, v2, tribb)
		{
			// If a triangle is perfectly axis-aligned, it will 'span' zero voxels, so the loops below
			//    will do nothing. To get around this, we expand the bbox a little bit.
			// (Take care to ensure that we don't loop over any voxels that are outside the actual grid)
			tribb.expandByScalar(0.000001);
			tribb.min.floor().max(vzero);
			tribb.max.ceil().max(vzero).min(outgrid.dims);
			for (var z = tribb.min.z; z < tribb.max.z; z++)
				for (var y = tribb.min.y; y < tribb.max.y; y++)
					for (var x = tribb.min.x; x < tribb.max.x; x++)
					{
						vmin.set(x, y, z);
						vmax.set(x+1, y+1, z+1);
						// Triangle has to intersect voxel
						if (Intersection.intersectTriangleBBox(vmin, vmax, v0, v1, v2))
						{
							outgrid.set(x, y, z);
						}
					}
		}
	})();

	Geo.Geometry.prototype.voxelize = (function(){
		var worldtovox = new THREE.Matrix4();
		var translate = new THREE.Matrix4();
		var gridbounds = new THREE.Box3();
		var touchedbb = new THREE.Box3();
		var p0 = new THREE.Vector3();
		var p1 = new THREE.Vector3();
		var p2 = new THREE.Vector3();
		var tribb = new THREE.Box3();
		return function(outgrid, bounds, dimsOrSize, solid)
		{
			var dims;
			if (dimsOrSize instanceof THREE.Vector3)
				dims = dimsOrSize;
			else
			{
				var voxelSize = dimsOrSize;
				dims = bounds.size().divideScalar(voxelSize).ceil();
			}
			outgrid.resize(dims);
			var extents = bounds.size();
			var xsize = extents.x / dims.x;
			var ysize = extents.y / dims.y;
			var zsize = extents.z / dims.z;
			worldtovox.makeScale(1/xsize, 1/ysize, 1/zsize);
			var origin = bounds.min.clone().negate();
			translate.makeTranslation(origin.x, origin.y, origin.z);	// bleh, I hate having to use this form...
			worldtovox.multiply(translate);
			var numtris = this.indices.length / 3;
			gridbounds.set(vzero, outgrid.dims);
			touchedbb.makeEmpty();
			// TODO(?): Parallelize this loop using WebWorkers?
			for (var i = 0; i < numtris; i++)
			{
				p0.copy(this.vertices[this.indices[3*i].vertex]);
				p1.copy(this.vertices[this.indices[3*i + 1].vertex]);
				p2.copy(this.vertices[this.indices[3*i + 2].vertex]);
				p0.applyMatrix4(worldtovox);
				p1.applyMatrix4(worldtovox);
				p2.applyMatrix4(worldtovox);
				tribb.makeEmpty();
				tribb.expandByPoint(p0); tribb.expandByPoint(p1); tribb.expandByPoint(p2);
				if (tribb.isIntersectionBox(gridbounds))
				{
					voxelizeTriangle(outgrid, p0, p1, p2, tribb);
					touchedbb.union(tribb);
				}
			}
			if (solid) outgrid.fillInterior(touchedbb);
		}
	})();

	// Intersection testing

	var contractTri = (function() {
		var CONTRACT_EPS = 1e-10;
		var centroid = new THREE.Vector3();
		var v0mc = new THREE.Vector3();
		var v1mc = new THREE.Vector3();
		var v2mc = new THREE.Vector3();
		return function(v0, v1, v2)
		{
			centroid.copy(v0).add(v1).add(v2).multiplyScalar(1/3);
			v0.sub(v0mc.copy(v0).sub(centroid).multiplyScalar(CONTRACT_EPS));
			v1.sub(v1mc.copy(v1).sub(centroid).multiplyScalar(CONTRACT_EPS));
			v2.sub(v1mc.copy(v1).sub(centroid).multiplyScalar(CONTRACT_EPS));
		}
	})();

	Geo.Geometry.prototype.intersects = (function() {
		var FUDGE_FACTOR = 1e-10;
		var u0 = new THREE.Vector3();
		var u1 = new THREE.Vector3();
		var u2 = new THREE.Vector3();
		var v0 = new THREE.Vector3();
		var v1 = new THREE.Vector3();
		var v2 = new THREE.Vector3();
		var thistribbox = new THREE.Box3();
		var othertribbox = new THREE.Box3();
		return function(othergeo)
		{
			// First, check that the overall bboxes intersect
			if (!this.getbbox().isIntersectionBox(other.getbbox()))
				return false;
			// Check every triangle against every other triangle
			// (Check bboxes first, natch)
			var numThisTris = this.indices.length/3;
			var numOtherTris = othergeo.indices.length/3;
			for (var j = 0; j < numSelfTris; j++)
			{
				u0.copy(this.vertices[this.indices[3*j].vertex]);
				u1.copy(this.vertices[this.indices[3*j + 1].vertex]);
				u2.copy(this.vertices[this.indices[3*j + 2].vertex]);
				contractTri(u0, u1, u2);
				thistribbox.makeEmpty();
				thistribbox.expandByPoint(u0); thistribbox.expandByPoint(u1); thistribbox.expandByPoint(u2);
				if (thistribbox.isIntersectionBox(othergeo.getbbox()))
				{
					for (var i = 0; i < numOtherTris; i++)
					{
						v0.copy(othergeo.vertices[othergeo.indices[3*j].vertex]);
						v1.copy(othergeo.vertices[othergeo.indices[3*j + 1].vertex]);
						v2.copy(othergeo.vertices[othergeo.indices[3*j + 2].vertex]);
						contractTri(v0, v1, v2);
						othertribbox.makeEmpty();
						othertribbox.expandByPoint(u0); othertribbox.expandByPoint(u1); othertribbox.expandByPoint(u2);
						if (thistribbox.isIntersectionBox(othertribbox))
							if (Intersection.intersectTriangleTriangle(u0, u1, u2, v0, v1, v2, false, FUDGE_FACTOR))
								return true;
					}
				}
			}
			return false;
		}
	})();

	Geo.Geometry.prototype.selfIntersects = function()
	{
		return this.intersects(this);
	}

	// ------------------------------------------------------------------------

	// Geometry creation utilities

	function quad(geo, i0, i1, i2, i3, ni)
	{
		geo.indices.push({vertex: i0, normal: ni, uv: -1});
		geo.indices.push({vertex: i1, normal: ni, uv: -1});
		geo.indices.push({vertex: i2, normal: ni, uv: -1});
		geo.indices.push({vertex: i2, normal: ni, uv: -1});
		geo.indices.push({vertex: i3, normal: ni, uv: -1});
		geo.indices.push({vertex: i0, normal: ni, uv: -1});
	}

	function box(geo, cx, cy, cz, lx, ly, lz)
	{
		var xh = lx*0.5;
		var yh = ly*0.5;
		var zh = lz*0.5;
		var vi = geo.vertices.length;

		geo.vertices.push(new THREE.Vector3(cx - xh, cy - yh, cz - zh));
		geo.vertices.push(new THREE.Vector3(cx - xh, cy - yh, cz + zh));
		geo.vertices.push(new THREE.Vector3(cx - xh, cy + yh, cz - zh));
		geo.vertices.push(new THREE.Vector3(cx - xh, cy + yh, cz + zh));
		geo.vertices.push(new THREE.Vector3(cx + xh, cy - yh, cz - zh));
		geo.vertices.push(new THREE.Vector3(cx + xh, cy - yh, cz + zh));
		geo.vertices.push(new THREE.Vector3(cx + xh, cy + yh, cz - zh));
		geo.vertices.push(new THREE.Vector3(cx + xh, cy + yh, cz + zh));

		// Back
		geo.normals.push(new THREE.Vector3(0, 0, -1));
		quad(geo, vi+2, vi+6, vi+4, vi+0, geo.normals.length-1);

		// Front
		geo.normals.push(new THREE.Vector3(0, 0, 1));
		quad(geo, vi+1, vi+5, vi+7, vi+3, geo.normals.length-1);

		// Left
		geo.normals.push(new THREE.Vector3(-1, 0, 0));
		quad(geo, vi+0, vi+1, vi+3, vi+2, geo.normals.length-1);

		// Right
		geo.normals.push(new THREE.Vector3(1, 0, 0));
		quad(geo, vi+6, vi+7, vi+5, vi+4, geo.normals.length-1);

		// Bottom
		geo.normals.push(new THREE.Vector3(0, -1, 0));
		quad(geo, vi+4, vi+5, vi+1, vi+0, geo.normals.length-1);

		// Top
		geo.normals.push(new THREE.Vector3(0, 1, 0));
		quad(geo, vi+2, vi+3, vi+7, vi+6, geo.normals.length-1);
	}

	Geo.addBox = box,

	Geo.box = function(cx, cy, cz, lx, ly, lz)
	{
		var b = new Geo.Geometry();
		box(b, cx, cy, cz, lx, ly, lz);
		return b;
	}


	// ------------------------------------------------------------------------

	// Recursive chain definition of combined geometry
	// Roughly like a Scheme list (where car == this.geo and cdr == this.next),
	//    except that the 'empty list' is actually an object with both this.geo
	//    and this.next == null.
	Geo.GeometryChain = function(geo, next)
	{
		this.geo = geo || null;
		this.next = next || null;
		this.boundingBox = null;
	}

	Geo.GeometryChain.create = function(geo, next) { return new Geo.GeometryChain(geo, next); }

	Geo.GeometryChain.prototype = {

		constructor: Geo.GeometryChain,

		length: function()
		{
			var len = 0;
			var currchain = this;
			while (currchain.geo !== null)
			{
				len = len + 1;
				currchain = currchain.next;
			}
			return len;
		},

		combine: function(primgeo)
		{
			return new Geo.GeometryChain(primgeo, this);
		},

		computeBoundingBox: function()
		{
			// Only compute if we haven't already
			// (Basically memoization, since this object is immutable)
			if (this.boundingBox == null)
			{
				if (this.geo !== null)
				{
					this.boundingBox = this.geo.getbbox().clone();
					this.next.computeBoundingBox();
					if (this.next.boundingBox !== null)
						this.boundingBox.union(this.next.boundingBox);
				}
			}
		},

		toPrimGeo: function()
		{
			if (this.geo == null)
				return null;
			else
			{
				var accumgeo = this.geo.clone();
				var currchain = this.next;
				while (currchain.geo !== null)
				{
					accumgeo.merge(currchain.geo);
					currchain = currchain.next;
				}
				return accumgeo;
			}
		}
	};

	// ------------------------------------------------------------------------

	return Geo;

})();



