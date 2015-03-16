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

		transform: (function() {
			var normalmat = new THREE.Matrix4();
			return function (mat, isLengthPreserving)
			{
				var nv = this.vertices.length;
				while(nv--)
					this.vertices[nv].applyMatrix4(mat);
				var nn = this.normals.length;
				if (isLengthPreserving)
				{
					while(nn--)
						this.normals[nn].transformDirection(mat);
				}
				else
				{
					normalmat.getInverse(mat).transpose();
					while(nn--)
						this.normals[nn].transformDirection(normalmat).normalize();
				}
			}
		})(),

		mergeWithTransform: (function() {
			var normalmat = new THREE.Matrix4();
			return function (othergeo, mat, isLengthPreserving)
			{
				var nverts = this.vertices.length;
				var nnorms = this.normals.length;
				var nuvs = this.uvs.length;
				for (var i = 0; i < other.vertices.length; i++)
					this.vertices.push(other.vertices[i].clone().applyMatrix4(mat));
				if (isLengthPreserving)
				{
					for (var i = 0; i < other.normals.length; i++)
						this.normals.push(other.normals[i].clone().transformDirection(mat));
				}
				else
				{
					normalmat.getInverse(mat).transpose();
					for (var i = 0; i < other.normals.length; i++)
						this.normals.push(other.normals[i].clone().transformDirection(normalmat).normalize());
				}
				for (var i = 0; i < other.uvs.length; i++)
					this.uvs.push(other.uvs[i].clone());
				for (var i = 0; i < other.indices.length; i++)
				{
					var oidx = other.indices[i];
					this.indices.push({vertex: oidx.vertex + nverts, normal: oidx.normal + nnorms, uv: oidx.uv + nuvs});
				}
			}
		})(),

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
		return function (outgrid, v0, v1, v2, tribb)
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
						// Don't bother checking this voxel if it is already set.
						if (!outgrid.isset(x, y, z))
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
		return function (outgrid, bounds, dimsOrSize, solid)
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
			// if (solid) outgrid.fillInterior(touchedbb);
			if (solid) outgrid.fillInteriorScanline(touchedbb);
		}
	})();

	// Intersection testing

	var contractTri = (function() {
		var CONTRACT_EPS = 1e-10;
		var centroid = new THREE.Vector3();
		var v0mc = new THREE.Vector3();
		var v1mc = new THREE.Vector3();
		var v2mc = new THREE.Vector3();
		return function (v0, v1, v2)
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
		return function (othergeo)
		{
			// First, check that the overall bboxes intersect
			if (!this.getbbox().isIntersectionBox(othergeo.getbbox()))
				return false;
			// Check every triangle against every other triangle
			// (Check bboxes first, natch)
			var numThisTris = this.indices.length/3;
			var numOtherTris = othergeo.indices.length/3;
			for (var j = 0; j < numThisTris; j++)
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
						v0.copy(othergeo.vertices[othergeo.indices[3*i].vertex]);
						v1.copy(othergeo.vertices[othergeo.indices[3*i + 1].vertex]);
						v2.copy(othergeo.vertices[othergeo.indices[3*i + 2].vertex]);
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

	Geo.Geometry.prototype.addBox = function(cx, cy, cz, lx, ly, lz)
	{
		var xh = lx*0.5;
		var yh = ly*0.5;
		var zh = lz*0.5;
		var vi = this.vertices.length;

		this.vertices.push(new THREE.Vector3(cx - xh, cy - yh, cz - zh));
		this.vertices.push(new THREE.Vector3(cx - xh, cy - yh, cz + zh));
		this.vertices.push(new THREE.Vector3(cx - xh, cy + yh, cz - zh));
		this.vertices.push(new THREE.Vector3(cx - xh, cy + yh, cz + zh));
		this.vertices.push(new THREE.Vector3(cx + xh, cy - yh, cz - zh));
		this.vertices.push(new THREE.Vector3(cx + xh, cy - yh, cz + zh));
		this.vertices.push(new THREE.Vector3(cx + xh, cy + yh, cz - zh));
		this.vertices.push(new THREE.Vector3(cx + xh, cy + yh, cz + zh));

		// Back
		this.normals.push(new THREE.Vector3(0, 0, -1));
		quad(this, vi+2, vi+6, vi+4, vi+0, this.normals.length-1);

		// Front
		this.normals.push(new THREE.Vector3(0, 0, 1));
		quad(this, vi+1, vi+5, vi+7, vi+3, this.normals.length-1);

		// Left
		this.normals.push(new THREE.Vector3(-1, 0, 0));
		quad(this, vi+0, vi+1, vi+3, vi+2, this.normals.length-1);

		// Right
		this.normals.push(new THREE.Vector3(1, 0, 0));
		quad(this, vi+6, vi+7, vi+5, vi+4, this.normals.length-1);

		// Bottom
		this.normals.push(new THREE.Vector3(0, -1, 0));
		quad(this, vi+4, vi+5, vi+1, vi+0, this.normals.length-1);

		// Top
		this.normals.push(new THREE.Vector3(0, 1, 0));
		quad(this, vi+2, vi+3, vi+7, vi+6, this.normals.length-1);
	}

	// TODO: These normals are technically wrong if the top and bottom radii are different...
	function circleOfVertsAndNormals(geo, c, r, n)
	{
		for (var i = 0; i < n; i++)
		{
			var ang = i*2*Math.PI;
			var norm = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang))
			geo.normals.push(norm);
			var vert = norm.clone().multiplyScalar(r).add(c);
			geo.vertices.push(vert);
		}
	}

	function disk(geo, centeridx, circbaseidx, normalidx, n)
	{
		for (var i = 0; i < n; i++)
		{
			geo.indices.push({vertex: centeridx, normal: normalidx, uv: -1});
			geo.indices.push({vertex: circbaseidx+i, normal: normalidx, uv: -1});
			geo.indices.push({vertex: circbaseidx+(i+1)%n, normal: normalidx, uv: -1});
		}
	}

	Geo.Geometry.prototype.addCylinder = function(x, y, z, height, n, baseRadius, topRadius)
	{
		var baseCenter = new THREE.Vector3(x, y, z);
		var topCenter = baseCenter.clone(); topCenter.y += height;
		// Make perimeter vertices on the top and bottom
		var nv = this.vertices.length;
		var nn = this.normals.length;
		circleOfVertsAndNormals(this, baseCenter, baseRadius, n);
		if (topRadius === undefined)
		{
			// If the two radii are the same, then we can just translate the bottom circle up.
			for (var i = 0; i < n; i++)
			{
				var topv = this.vertices[nv+i].clone(); topv.y += height;
				this.vertices.push(topv);
			}
		}
		else
		{
			// Otherwise, we need to generate the top circle from scratch.
			circleOfVertsAndNormals(this, topCenter, topRadius, n);
		}
		// Make the sides
		var i0, i1, i2, i3;
		for (var i = 0; i < n; i++)
		{
			i0 = i; i1 = (i+1)%n; i2 = n + (i+1)%n; i3 = n + i;
			this.indices.push({vertex: nv+i0, normal: nn+i0, uv: -1});
			this.indices.push({vertex: nv+i1, normal: nn+i1, uv: -1});
			this.indices.push({vertex: nv+i2, normal: nn+i2, uv: -1});
			this.indices.push({vertex: nv+i2, normal: nn+i2, uv: -1});
			this.indices.push({vertex: nv+i3, normal: nn+i3, uv: -1});
			this.indices.push({vertex: nv+i0, normal: nn+i0, uv: -1});
		}
		// Place center vertices, make the end caps
		this.vertices.push(baseCenter);
		this.normals.push(new THREE.Vector3(0, -1, 0));
		disk(this, this.vertices.length-1, nv, this.normals.length-1, n);
		this.vertices.push(topCenter);
		this.normals.push(new THREE.Vector3(0, 1, 0));
		disk(this, this.vertices.length, nv+n, this.normals.length-1, n);
	}

	// Make functional versions of all shape generators.
	Geo.Shapes = {};
	function makeFunctional(fn)
	{
		return function()
		{
			var g = new Geo.Geometry();
			fn.apply(g, arguments);
			return g;
		}
	}
	for (var fnname in Geo.Geometry.prototype)
	{
		if (fnname.startsWith("add"))
		{
			var fn = Geo.Geometry.prototype[fnname];
			var purename = fnname.replace("add", "");
			Geo.Shapes[purename] = makeFunctional(fn);
		}
	}

	// ------------------------------------------------------------------------

	return Geo;

})();



