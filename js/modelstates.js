var ModelStates = (function()
{
	var ModelStates = {};

	// ------------------------------------------------------------------------

	ModelStates.VoxelizingModelState = function(voxparams)
	{
		this.geometry = null;
		this.grid = null;
		this.next = null;
		this.length = 0;
		this.voxparams = voxparams;
	}

	// Voxparams has:
	//   - 'bounds'
	//   - one of 'size' or 'dims'
	ModelStates.VoxelizingModelState.create = function(voxparams)
	{
		var ms = new ModelStates.VoxelizingModelState(voxparams);
		ms.geometry = new Geo.Geometry();
		if (voxparams.dims === undefined)
			voxparams.dims = voxparams.bounds.size().divideScalar(voxparams.size).ceil();
		ms.grid = new Grids.BinaryGrid3(voxparams.dims);
		return ms;
	}

	ModelStates.VoxelizingModelState.extend = function(geo, next)
	{
		var ms = new ModelStates.VoxelizingModelState(next.voxparams);
		ms.geometry = geo;
		ms.grid = next.grid.clone();
		geo.voxelize(ms.grid, ms.voxparams.bounds, ms.grid.dims, true);
		ms.next = next;
		ms.length = 1 + next.length;
		return ms;
	}

	ModelStates.VoxelizingModelState.prototype = 
	{
		constructor: ModelStates.VoxelizingModelState,

		addGeometry: function(geo)
		{
			return ModelStates.VoxelizingModelState.extend(geo, this);
		},

		getCompleteGeometry: function()
		{
			var accumgeo = new Geo.Geometry();
			for (var currstate = this; currstate !== null; currstate = currstate.next)
				accumgeo.merge(currstate.geometry);
			return accumgeo;
		}
	}

	// ------------------------------------------------------------------------

	return ModelStates;

})();