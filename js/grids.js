var Grids = (function(){

	var Grids = {};

	var BITS_PER_UINT = Uint32Array.BYTES_PER_ELEMENT * 8;

	// Fast population count, from https://github.com/BartMassey/popcount
	function popcount(x)
	{
		var m1 = 0x55555555;
		var m2 = 0xc30c30c3;
		x = x - ((x >>> 1) & m1)
		// console.log(x);
		// console.log((x & m2) >>> 0, ((x >>> 2) & m2) >>> 0, ((x >>> 4) & m2) >>> 0)
		x = ((x & m2) >>> 0) + (((x >>> 2) & m2) >>> 0) + (((x >>> 4) & m2) >>> 0)
		// console.log(x);
		x = x + (x >>> 6)
		// console.log(x);
		return (x + (x >>> 12) + (x >>> 24)) & 0x3f >>> 0;
	}

	// Empty Uint32Arrays, for fast array clearing using .set
	// (Stop-gap until browsers support ES6's .fill method)
	var emptyArrays = {}
	function getEmptyArray(length)
	{
		var res = emptyArrays[length];
		if (res === undefined)
		{
			res = new Uint32Array(length);
			emptyArrays[length] = res;
		}
		return res;
	}

	// ------------------------------------------------------------------------

	// 3D compressed binary grid representation
	// Data is linearized in x, y, z order (x runs fastest, z runs slowest)
	Grids.BinaryGrid3 = function(dims)
	{
		this.dims = dims || new THREE.Vector3(0, 0, 0);
		this.data = null;
		if (this.dims.x > 0 && this.dims.y > 0 && this.dims.z > 0)
			this.resize(dims);
	}

	Grids.BinaryGrid3.prototype = {

		constructor: Grids.BinaryGrid3,

		numuints: function()
		{
			return Math.floor((this.numcells() + BITS_PER_UINT - 1) / BITS_PER_UINT);
		},

		numcells: function()
		{
			return this.dims.x * this.dims.y * this.dims.z;
		},

		numFilledCells: function()
		{
			var num = 0;
			for (var z = 0; z < this.dims.z; z++)
				for (var y = 0; y < this.dims.y; y++)
					for (var x = 0; x < this.dims.x; x++)
						num = num + this.isset(x,y,z);
			return num;
		},

		numCellsPadded: function()
		{
			return this.data.length * BITS_PER_UINT;
		},

		resize: function(dims)
		{
			if (this.data == null || !this.dims.equals(dims))
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
			var n = new Grids.BinaryGrid3();
			n.copy(this);
			return n;
		},

		clearall: function()
		{
			if (this.data !== null)
			{
				this.data.set(getEmptyArray(this.data.length));
			}
		},

		isset: function(x, y, z)
		{
			var linidx = z*this.dims.y*this.dims.x + y*this.dims.x + x;
			var baseidx = Math.floor(linidx / BITS_PER_UINT);
			var localidx = linidx % BITS_PER_UINT;
			return (this.data[baseidx] & (1 << localidx)) !== 0;
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
			if (!this.dims.equals(other.dims))
				throw "Cannot union grids of unequal dimensions";
		},

		unionInPlace: function(other)
		{
			this.assertSameDims(other);
			var n = this.data.length;
			while(n--) { this.data[n] |= other.data[n]; }
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
			var n = this.data.length;
			while(n--) {
				num += popcount(~(this.data[n] ^ other.data[n]));
			}
			return num;
		},

		percentCellsEqualPadded: function(other)
		{
			var n = this.numCellsEqualPadded(other);
			return n / this.numCellsPadded();
		},

		// Generate a mesh from this grid
		toMesh: function(outgeo, bounds)
		{
			function lerp(lo, hi, t) { return (1-t)*lo + t*hi; }
			outgeo.clear();
			var extents = bounds.size();
			var xsize = extents.x/this.dims.x;
			var ysize = extents.y/this.dims.y;
			var zsize = extents.z/this.dims.z;
			for (var zi = 0; zi < this.dims.z; zi++)
			{
				var z = lerp(bounds.min.z, bounds.max.z, (zi+0.5)/this.dims.z);
				for (var yi = 0; yi < this.dims.y; yi++)
				{
					var y = lerp(bounds.min.y, bounds.max.y, (yi+0.5)/this.dims.y);
					for (var xi = 0; xi < this.dims.x; xi++)
					{
						var x = lerp(bounds.min.x, bounds.max.x, (xi+0.5)/this.dims.x);
						if (this.isset(xi, yi, zi))
							Geo.addBox(outgeo, x, y, z, xsize, ysize, zsize);
					}
				}
			}
		}

	};

	// Flood-fill interior of part of a hollow voxel grid.
	Grids.BinaryGrid3.prototype.fillInterior = (function() {
		function voxel(x, y, z) { return {x: x, y: y, z: z}; }
		var visited = new Grids.BinaryGrid3();
		var frontier = new Grids.BinaryGrid3();
		var fringe = null;
		return function (bounds)
		{
			visited.copy(this);		// Already-filled cells count as visited.
			frontier.resize(this.dims);
			// Start expanding from every cell we haven't yet visisted.
			for (var z = bounds.min.z; z < bounds.max.z; z++)
				for (var y = bounds.min.y; y < bounds.max.y; y++)
					for (var x = bounds.min.x; x < bounds.max.x; x++)
						if (!visited.isset(x, y, z))
						{
							frontier.clearall();
							var isoutside = false;
							fringe = [];
							fringe.push(voxel(x,y,z));
							while (fringe.length > 0)
							{
								var v = fringe.pop();
								// If we expanded to the edge of the bounds, then this
								//    region is outside. We don't care about it, so we
								//    can bail early
								if (v.x == bounds.min.x || v.x == bounds.max.x-1 ||
									v.y == bounds.min.y || v.y == bounds.max.y-1 ||
									v.z == bounds.min.z || v.z == bounds.max.z-1)
								{
									isoutside = true;
									break;
								}
								// Otherwise, expand to the neighbors
								else
								{
									frontier.set(v.x, v.y, v.z);
									visited.set(v.x, v.y, v.z);
									if (!visited.isset(v.x-1, v.y, v.z))
										fringe.push(voxel(v.x-1, v.y, v.z));
									if (!visited.isset(v.x+1, v.y, v.z))
										fringe.push(voxel(v.x+1, v.y, v.z));
									if (!visited.isset(v.x, v.y-1, v.z))
										fringe.push(voxel(v.x, v.y-1, v.z));
									if (!visited.isset(v.x, v.y+1, v.z))
										fringe.push(voxel(v.x, v.y+1, v.z));
									if (!visited.isset(v.x, v.y, v.z-1))
										fringe.push(voxel(v.x, v.y, v.z-1));
									if (!visited.isset(v.x, v.y, v.z+1))
										fringe.push(voxel(v.x, v.y, v.z+1));
								}
							}
							// Once we've grown this region to completion, check whether it is
							//    inside or outside. If inside, add it to this.
							if (!isoutside) this.unionInPlace(frontier);
						}
		}
	})();

	// Flood-fill using a faster, scanline-based algorithm.
	// Parts of this are adapated from http://lodev.org/cgtutor/floodfill.html
	Grids.BinaryGrid3.prototype.fillInteriorScanline = (function() {
		function voxel(x, y, z) { return {x: x, y: y, z: z}; }
		var visited = new Grids.BinaryGrid3();
		var frontier = new Grids.BinaryGrid3();
		var fringe = null;
		return function (bounds)
		{
			visited.copy(this);		// Already-filled cells count as visited.
			frontier.resize(this.dims);
			// Start expanding from every cell we haven't yet visisted.
			for (var z = bounds.min.z; z < bounds.max.z; z++)
				for (var y = bounds.min.y; y < bounds.max.y; y++)
					for (var x = bounds.min.x; x < bounds.max.x; x++)
						if (!visited.isset(x, y, z))
						{
							frontier.clearall();
							var isoutside = false;
							fringe = [];
							fringe.push(voxel(x,y,z));
							while (fringe.length > 0)
							{
								var v = fringe.pop();
								// If we expanded to the edge of the bounds, then this
								//    region is outside. We don't care about it, so we
								//    can bail early
								if (v.x == bounds.min.x || v.x == bounds.max.x-1 ||
									v.y == bounds.min.y || v.y == bounds.max.y-1 ||
									v.z == bounds.min.z || v.z == bounds.max.z-1)
								{
									isoutside = true;
									break;
								}
								// Otherwise, fill one line and expand to the neighbors
								else
								{
									// Move to the 'beginning' of the line
									while (v.x >= bounds.min.x && !visited.isset(v.x, v.y, v.z)) v.x--;
									v.x++;
									// Again, bail early if we hit the edge of the bounds
									if (v.x == bounds.min.x) { isoutside = true; break; }
									var spandown = false;
									var spanup = false;
									var spanback = false;
									var spanfront = false;
									while (v.x < bounds.max.x && !visited.isset(v.x, v.y, v.z))
									{
										frontier.set(v.x, v.y, v.z);
										visited.set(v.x, v.y, v.z);
										// Down neigbor
										if (!spandown && !visited.isset(v.x, v.y-1, v.z))
										{
											fringe.push(voxel(v.x, v.y-1, v.z));
											spandown = true;
										}
										else if (spandown && visited.isset(v.x, v.y-1, v.z))
											spandown = false;
										// Up neigbor
										if (!spanup && !visited.isset(v.x, v.y+1, v.z))
										{
											fringe.push(voxel(v.x, v.y+1, v.z));
											spanup = true;
										}
										else if (spanup && visited.isset(v.x, v.y+1, v.z))
											spanup = false;
										// Back neigbor
										if (!spanback && !visited.isset(v.x, v.y, v.z-1))
										{
											fringe.push(voxel(v.x, v.y, v.z-1));
											spanback = true;
										}
										else if (spanback && visited.isset(v.x, v.y, v.z-1))
											spanback = false;
										// Front neigbor
										if (!spanfront && !visited.isset(v.x, v.y, v.z+1))
										{
											fringe.push(voxel(v.x, v.y, v.z+1));
											spanfront = true;
										}
										else if (spanfront && visited.isset(v.x, v.y, v.z+1))
											spanfront = false;

										v.x++;
									}
									// Again, bail early if we hit the edge of the bounds
									if (v.x == bounds.max.x) { isoutside = true; break; }
								}
							}
							// Once we've grown this region to completion, check whether it is
							//    inside or outside. If inside, add it to this.
							if (!isoutside) this.unionInPlace(frontier);
						}
		}
	})();

	// ------------------------------------------------------------------------

	return Grids;

})();




