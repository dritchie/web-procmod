var Geo = (function() {

	var Geo = {}

	// ------------------------------------------------------------------------

	// Small, bare-bones geometry object
	Geo.Geometry = function()
	{
		this.vertices = [];
		this.indices = [];
		this.normals = [];
		this.uvs = [];
	}

	Geo.new = function() { return new Geo.Geometry(); }

	Geo.Geometry.prototype = {

		constructor: Geo.Geometry,

		merge: function(other)
		{
			var nverts = this.vertices.length;
			var nnorms = this.normals.length;
			var nuvs = self.uvs.length;
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

		toThreeGeo: function()
		{
			// TODO: ???
		}
	}

	// ------------------------------------------------------------------------

	// Recursive chain definition of combined geometry
	Geo.GeometryChain = function(geo, next)
	{
		this.geo = geo || null;
		this.next = next || null;
		this.boundingBox = null;
	}

	Geo.newChain = function(geo, next) { return new Geo.GeometryChain(geo, next); }

	Geo.GeometryChain.prototype = {

		constructor: Geo.GeometryChain,

		combine: function(primgeo)
		{
			if (this.geo == null)
			{
				this.geo = primgeo;
				return this;
			}
			else
				return new Geo.GeometryChain(primgeo, this);
		},

		computeBoundingBox: function()
		{
			if (this.boundingBox == null)
			{
				if (this.geo == null)
					this.boundingBox = new THREE.Box3();
				else
				{
					this.geo.computeBoundingBox();
					this.boundingBox = this.geo.boundingBox.clone();
					if (this.next !== null)
					{
						this.next.computeBoundingBox();
						this.boundingBox.union(this.next.boundingBox);
					}
				}
			}
		},

		toPrimGeo: function()
		{
			var combogeo = this.geo.clone();
			if (this.next !== null)
				combogeo.merge(this.next.toPrimGeo());
			return combogeo;
		}
	};

	// ------------------------------------------------------------------------

	return Geo;

})();


