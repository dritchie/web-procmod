var Geo = (function() {

	var Geo = {}

	// ------------------------------------------------------------------------

	// // Small, bare-bones geometry object
	// Geo.Geometry = function()
	// {
	// 	this.vertices = [];
	// 	this.indices = [];
	// 	this.normals = [];
	// 	this.uvs = [];
	// }

	// Geo.new = function() { return new Geo.Geometry(); }

	// Geo.Geometry.prototype = {

	// 	constructor: Geo.Geometry,

	// 	merge: function(other)
	// 	{
	// 		var nverts = this.vertices.length;
	// 		var nnorms = this.normals.length;
	// 		var nuvs = self.uvs.length;
	// 		for (var i = 0; i < other.vertices.length; i++)
	// 			this.vertices.push(other.vertices[i].clone());
	// 		for (var i = 0; i < other.normals.length; i++)
	// 			this.normals.push(other.normals[i].clone());
	// 		for (var i = 0; i < other.uvs.length; i++)
	// 			this.uvs.push(other.uvs[i].clone());
	// 		for (var i = 0; i < other.indices.length; i++)
	// 		{
	// 			var oidx = other.indices[i];
	// 			this.indices.push({vertex: oidx.vertex + nverts, normal: oidx.normal + nnorms, uv: oidx.uv + nuvs});
	// 		}
	// 	},

	// 	clone: function()
	// 	{
	// 		var ngeo = new Geo.Geometry();
	// 		ngeo.merge(this);
	// 		return ngeo;
	// 	},

	// 	combine: function(other)
	// 	{
	// 		var ngeo = this.clone();
	// 		ngeo.merge(other);
	// 		return ngeo;
	// 	}
	// }


	// Recursive chain definition of combined geometry
	Geo.Geometry = function(geo, next)
	{
		this.geo = geo || null;
		this.next = next || null;
		this.boundingBox = null;
	}

	Geo.new = function(geo, next) { return new Geo.Geometry(geo, next); }

	Geo.Geometry.prototype = {

		constructor: Geo.Geometry,

		combine: function(threegeo)
		{
			if (this.geo == null)
			{
				this.geo = threegeo;
				return this;
			}
			else
				return Geo.new(threegeo, this);
		},

		merge: function(threegeo)
		{
			if (this.geo == null)
				this.geo = threegeo;
			else
				this.geo.merge(threegeo);
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

		toThreeGeo: function()
		{
			var combogeo = this.geo.clone();
			if (this.next !== null)
				combogeo.merge(this.next.toThreeGeo());
			return combogeo;
		}
	};

	// ------------------------------------------------------------------------

	return Geo;

})();



