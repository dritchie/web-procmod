var Grids = (function(){

	var Grids = {};

	var BITS_PER_UINT = Uint32Array.BYTES_PER_ELEMENT * 8;

	// Fast population count, from https://github.com/BartMassey/popcount
	function popcount(x)
	{
		var m1 = 0x55555555;
		var m2 = 0xc30c30c3;
		x = x - ((x >> 1) & m1)
		x = (x & m2) + ((x >> 2) & m2) + ((x >> 4) & m2)
		x = x + (x >> 6)
		return (x + (x >> 12) + (x >> 24)) & 0x3f;
	}

	// ------------------------------------------------------------------------

	// 3D compressed binary grid representation
	// Data is linearized in x, y, z order (x runs fastest, z runs slowest)
	Grids.BinaryGrid3 = function(dims)
	{
		this.dims = dims || new THREE.Vector3(0, 0, 0);
		this.data = null;
		if (dims.x > 0 && dims.y > 0 && dims.z > 0)
			this.resize(dims);
	}

	Grids.BinaryGrid3.prototype = {

		constructor: Grids.BinaryGrid3,

		numcells: function()
		{
			return this.dims.x * this.dims.y * this.dims.z;
		},

		numuints: function()
		{
			return (this.numcells() + BITS_PER_UINT - 1) / BITS_PER_UINT;
		},

		numcellsPadded: function()
		{
			return this.numuints() * BITS_PER_UINT;
		}

		resize: function(dims)
		{
			if (!this.dims.equal(dims))
			{
				this.dims.copy(dims);
				this.data = new Uint32Array(this.numuints());
			}
		},

		copy: function(other)
		{
			this.resize(other.dims);
			this.data.set(other.data);
		},

		clone: function()
		{
			var n = new Gridsels.BinaryGrid3();
			n.copy(this);
			return n;
		}

		clearall: function()
		{
			var n = this.numuints();
			for (var i = 0; i < n; i++)
				this.data[i] = 0;
		}

		isset: function(x, y, z)
		{
			var linidx = z*this.dims.y*this.dims.x + y*this.dims.x + x;
			var baseidx = Math.floor(linidx / BITS_PER_UINT);
			var localidx = linidx % BITS_PER_UINT;
			return (this.data[baseidx] && (1 << localidx)) !== 0;
		},

		set: function(x, y, z)
		{
			var linidx = z*this.dims.y*this.dims.x + y*this.dims.x + x;
			var baseidx = Math.floor(linidx / BITS_PER_UINT);
			var localidx = linidx % BITS_PER_UINT;
			this.data[baseidx] |= (1 << localidx);
		},

		toggle: function(x, y, z)
		{
			var linidx = z*this.dims.y*this.dims.x + y*this.dims.x + x;
			var baseidx = Math.floor(linidx / BITS_PER_UINT);
			var localidx = linidx % BITS_PER_UINT;
			this.data[baseidx] ^= (1 << localidx);
		},

		clear: function(x, y, z)
		{
			var linidx = z*this.dims.y*this.dims.x + y*this.dims.x + x;
			var baseidx = Math.floor(linidx / BITS_PER_UINT);
			var localidx = linidx % BITS_PER_UINT;
			this.data[baseidx] &= ~(1 << localidx);
		},

		assertSameDims: function(other)
		{
			if (!this.dims.equal(other.dims))
				throw "Cannot union grids of unequal dimensions";
		},

		unionInPlace: function(other)
		{
			this.assertSameDims(other);
			var n = this.numuints();
			for (var i = 0; i < n; i++)
				this.data[i] |= other.data[i];
		},

		union: function(other)
		{
			var n = this.clone();
			n.unionInPlace(other);
			return n;
		},

		numCellsEqual: function(other)
		{
			this.assertSameDims(other);
			var num = 0;
			for (var z = 0; z < this.dims.z; z++)
				for (var y = 0; y < this.dims.y; y++)
					for (var x = 0; x < this.dims.z; x++)
						num += (this.isset(x, y, z) == other.isset(x, y, z));
			return num;
		},

		percentCellsEqual: function(other)
		{
			var n = this.numCellsEqual(other);
			return n / this.numcells();
		},

		numCellsEqualPadded: function(other)
		{
			this.assertSameDims(other);
			var num = 0;
			var n = this.numuints();
			for (var i = 0; i < n; i++)
			{
				var x = ~(this.data[i] ^ other.data[i]);
				num += popcount(x);
			}
			return num;
		},

		percentCellsEqualPadded: function(other)
		{
			var n = this.numCellsEqualPadded(other);
			return n / this.numcellsPadded();
		}

	};

	// Flood-fill interior of part of a hollow voxel grid.
	function voxel(x, y, z) { return {x: x, y: y, z: z}; }
	Grids.BinaryGrid3.prototype.fillInterior = function(bounds)
	{
		var visited = this.clone();		// Already-filled cells count as visited.
		var frontier = new Grids.BinaryGrid3(this.xdim, this.ydim, this.zdim);
		// Start expanding from every cell we haven't yet visisted.
		for (var z = bounds.mins.z; z < bounds.maxs.z; z++)
			for (var y = bounds.mins.y; y < bounds.maxs.y; y++)
				for (var x = bounds.mins.x; x < bounds.maxs.x; x++)
					if (!visited.isset(x, y, z))
					{
						var isoutside = false;
						var fringe = [];
						fringe.push(voxel(x,y,z));
						while (fringe.length > 0)
						{
							var v = fringe.pop();
							frontier.set(v.x, v.y, v.z);
							// If we expanded to the edge of the bounds, then this
							//    region is outside.
							if (v.x == bounds.mins.x || v.x == bounds.maxs.x-1 ||
								v.y == bounds.mins.y || v.y == bounds.maxs.y-1 ||
								v.z == bounds.mins.z || v.z == bounds.maxs.z-1)
								isoutside = true;
							// Otherwise, expand to the neighbors
							else
							{
								visited.set(v.x, v.y, v.z);
								if (!visited.isset(v.x-1, v.y, v.z))
									fringe.insert(voxel(v.x-1, v.y, v.z));
								if (!visited.isset(v.x+1, v.y, v.z))
									fringe.insert(voxel(v.x+1, v.y, v.z));
								if (!visited.isset(v.x, v.y-1, v.z))
									fringe.insert(voxel(v.x, v.y-1, v.z));
								if (!visited.isset(v.x, v.y+1, v.z))
									fringe.insert(voxel(v.x, v.y+1, v.z));
								if (!visited.isset(v.x, v.y, v.z-1))
									fringe.insert(voxel(v.x, v.y, v.z-1));
								if (!visited.isset(v.x, v.y, v.z+1))
									fringe.insert(voxel(v.x, v.y, v.z+1));
							}
						}
						// Once we've grown this region to completion, check whether it is
						//    inside or outside. If inside, add it to this.
						if (!isoutside) this.unionInPlace(frontier);
						frontier.clearall();
					}
	}

	// ------------------------------------------------------------------------

	return Grids;

})();




