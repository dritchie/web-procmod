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
		this.boundingBox = null;
	}

	Geo.new = function() { return new Geo.Geometry(); }

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

		computeBoundingBox: function()
		{
			if (this.boundingBox == null)
				this.boundingBox = new THREE.Box3();
			this.boundingBox.setFromPoints(this.vertices);
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
		}
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

	Geo.newChain = function(geo, next) { return new Geo.GeometryChain(geo, next); }

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
					this.geo.computeBoundingBox();
					this.boundingBox = this.geo.boundingBox.clone();
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



