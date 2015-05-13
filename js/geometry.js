var Geo = (function() {

	var Geo = {}

	// ------------------------------------------------------------------------

	// Small, bare-bones geometry object
	// No normals (since we can compute those after the fact when it's time to display)
	// UVs are optional (i.e. can have empty this.uvs)
	Geo.Geometry = function()
	{
		this.vertices = [];
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
			var nuvs = this.uvs.length;
			for (var i = 0; i < other.vertices.length; i++)
				this.vertices.push(other.vertices[i].clone());
			for (var i = 0; i < other.uvs.length; i++)
				this.uvs.push(other.uvs[i].clone());
			for (var i = 0; i < other.indices.length; i++)
				this.indices.push(other.indices[i] + nverts);
		},

		transform: function (mat)
		{
			var nv = this.vertices.length;
			while(nv--)
				this.vertices[nv].applyMatrix4(mat);
		},

		mergeWithTransform: function (other, mat)
		{
			var nverts = this.vertices.length;
			var nuvs = this.uvs.length;
			for (var i = 0; i < other.vertices.length; i++)
				this.vertices.push(other.vertices[i].clone().applyMatrix4(mat));
			for (var i = 0; i < other.uvs.length; i++)
				this.uvs.push(other.uvs[i].clone());
			for (var i = 0; i < other.indices.length; i++)
				this.indices.push(other.indices[i] + nverts);
		},

		toThreeGeo: function()
		{
			var threegeo = new THREE.Geometry();
			// Copy vertices
			for (var i = 0; i < this.vertices.length; i++)
				threegeo.vertices.push(this.vertices[i].clone());
			// Copy faces and UVs
			for (var i = 0; i < this.indices.length/3; i++)
			{
				var i0 = this.indices[3*i];
				var i1 = this.indices[3*i + 1];
				var i2 = this.indices[3*i + 2];
				// Faces
				var face = new THREE.Face3(i0, i1, i2);
				threegeo.faces.push(face);
				// UVs
				if (this.uvs.length > 0) {
					var uvs = [];
					uvs.push(this.uvs[i0]);
					uvs.push(this.uvs[i1]);
					uvs.push(this.uvs[i2]);
					threegeo.faceVertexUvs[0].push(uvs);
				}
			}
			threegeo.computeFaceNormals();
			return threegeo;
		},

		// Assumes no UVs (just vertices)
		fromThreeGeo: function(threegeo)
		{
			this.clear();
			// Copy vertices
			for (var i = 0; i < threegeo.vertices.length; i++)
				this.vertices.push(threegeo.vertices[i].clone());
			// Copy faces
			for (var i = 0; i < threegeo.faces.length; i++)
			{
				var f = threegeo.faces[i];
				this.indices.push(f.a);
				this.indices.push(f.b);
				this.indices.push(f.c);
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
				p0.copy(this.vertices[this.indices[3*i]]);
				p1.copy(this.vertices[this.indices[3*i + 1]]);
				p2.copy(this.vertices[this.indices[3*i + 2]]);
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

	Geo.Geometry.prototype.intersects = (function() {
		var FUDGE_FACTOR = 1e-10;
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
				var u0 = this.vertices[this.indices[3*j]];
				var u1 = this.vertices[this.indices[3*j + 1]];
				var u2 = this.vertices[this.indices[3*j + 2]];
				thistribbox.makeEmpty();
				thistribbox.expandByPoint(u0); thistribbox.expandByPoint(u1); thistribbox.expandByPoint(u2);
				if (thistribbox.isIntersectionBox(othergeo.getbbox()))
				{
					for (var i = 0; i < numOtherTris; i++)
					{
						var v0 = othergeo.vertices[othergeo.indices[3*i]];
						var v1 = othergeo.vertices[othergeo.indices[3*i + 1]];
						var v2 = othergeo.vertices[othergeo.indices[3*i + 2]];
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

	// Find all the triangles involved in intersections between this and other.
	Geo.Geometry.prototype.intersectionGeo = (function() {
		var FUDGE_FACTOR = 1e-10;
		var thistribbox = new THREE.Box3();
		var othertribbox = new THREE.Box3();
		return function (othergeo)
		{
			var isectgeo = new Geo.Geometry();
			// First, check that the overall bboxes intersect
			if (!this.getbbox().isIntersectionBox(othergeo.getbbox()))
				return isectgeo;
			// Check every triangle against every other triangle
			// (Check bboxes first, natch)
			var numThisTris = this.indices.length/3;
			var numOtherTris = othergeo.indices.length/3;
			for (var j = 0; j < numThisTris; j++)
			{
				var u0 = this.vertices[this.indices[3*j]];
				var u1 = this.vertices[this.indices[3*j + 1]];
				var u2 = this.vertices[this.indices[3*j + 2]];
				thistribbox.makeEmpty();
				thistribbox.expandByPoint(u0); thistribbox.expandByPoint(u1); thistribbox.expandByPoint(u2);
				if (thistribbox.isIntersectionBox(othergeo.getbbox()))
				{
					for (var i = 0; i < numOtherTris; i++)
					{
						var v0 = othergeo.vertices[othergeo.indices[3*i]];
						var v1 = othergeo.vertices[othergeo.indices[3*i + 1]];
						var v2 = othergeo.vertices[othergeo.indices[3*i + 2]];
						othertribbox.makeEmpty();
						othertribbox.expandByPoint(u0); othertribbox.expandByPoint(u1); othertribbox.expandByPoint(u2);
						if (thistribbox.isIntersectionBox(othertribbox))
							if (Intersection.intersectTriangleTriangle(u0, u1, u2, v0, v1, v2, false, FUDGE_FACTOR))
							{
								// Add both triangles to isectgeo (unless this === othergeo
								//    in which case we just add one).
								var nv = isectgeo.vertices.length;
								isectgeo.vertices.push(u0.clone()); isectgeo.vertices.push(u1.clone()); isectgeo.vertices.push(u2.clone());
								isectgeo.indices.push(nv); isectgeo.indices.push(nv+1); isectgeo.indices.push(nv+2);
								if (this !== othergeo)
								{
									nv = isectgeo.vertices.length;
									isectgeo.vertices.push(v0.clone()); isectgeo.vertices.push(v1.clone()); isectgeo.vertices.push(v2.clone());
									isectgeo.indices.push(nv); isectgeo.indices.push(nv+1); isectgeo.indices.push(nv+2);
								}
							}
					}
				}
			}
			return isectgeo;
		}
	})();

	Geo.Geometry.prototype.selfIntersects = function()
	{
		return this.intersects(this);
	}

	Geo.Geometry.prototype.selfIntersectionGeo = function()
	{
		return this.intersectionGeo(this);
	}

	// ------------------------------------------------------------------------

	// Geometry creation utilities

	function quad(geo, i0, i1, i2, i3)
	{
		geo.indices.push(i0);
		geo.indices.push(i1);
		geo.indices.push(i2);
		geo.indices.push(i2);
		geo.indices.push(i3);
		geo.indices.push(i0);
	}
	Geo.Geometry.quad = quad;

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
		quad(this, vi+2, vi+6, vi+4, vi+0);
		// Front
		quad(this, vi+1, vi+5, vi+7, vi+3);
		// Left
		quad(this, vi+0, vi+1, vi+3, vi+2);
		// Right
		quad(this, vi+6, vi+7, vi+5, vi+4);
		// Bottom
		quad(this, vi+4, vi+5, vi+1, vi+0);
		// Top
		quad(this, vi+2, vi+3, vi+7, vi+6);
	}

	function circleOfVerts(geo, c, r, n)
	{
		for (var i = 0; i < n; i++)
		{
			var ang = (i/n)*2*Math.PI;
			var v = new THREE.Vector3(r*Math.cos(ang)+c.x, c.y, r*Math.sin(ang)+c.z);
			geo.vertices.push(v);
		}
	}

	function disk(geo, centeridx, circbaseidx, n, reverse)
	{
		if (reverse)
		{
			for (var i = 0; i < n; i++)
			{
				geo.indices.push(centeridx);
				geo.indices.push(circbaseidx+(i+1)%n);
				geo.indices.push(circbaseidx+i);
			}
		}
		else
		{
			for (var i = 0; i < n; i++)
			{
				geo.indices.push(centeridx);
				geo.indices.push(circbaseidx+i);
				geo.indices.push(circbaseidx+(i+1)%n);
			}
		}
	}

	Geo.Geometry.prototype.addCylinder = function(x, y, z, height, n, baseRadius, topRadius)
	{
		topRadius = topRadius || baseRadius
		var baseCenter = new THREE.Vector3(x, y, z);
		var topCenter = baseCenter.clone(); topCenter.y += height;
		// Make perimeter vertices on the top and bottom
		var nv = this.vertices.length;
		circleOfVerts(this, baseCenter, baseRadius, n);
		if (baseRadius === topRadius)
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
			circleOfVerts(this, topCenter, topRadius, n);
		}
		// Make the sides
		var i0, i1, i2, i3;
		for (var i = 0; i < n; i++)
		{
			i0 = i;
			i1 = n + i;
			i2 = n + (i+1)%n;
			i3 = (i+1)%n;
			quad(this, nv+i0, nv+i1, nv+i2, nv+i3);
		}
		// Place center vertices, make the end caps
		this.vertices.push(baseCenter);
		disk(this, this.vertices.length-1, nv, n, false);
		this.vertices.push(topCenter);
		disk(this, this.vertices.length-1, nv+n, n, true);
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



