var ModelStates = (function()
{
	var ModelStates = {};

	// ------------------------------------------------------------------------

	ModelStates.VoxelizingModelState = function(voxparams)
	{
		this.geometry = null;
		this.grid = null;
		this.bbox = null;
		this.next = null;
		this.length = 0;
		this.score = 0;
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
		ms.bbox = new THREE.Box3();
		return ms;
	}

	ModelStates.VoxelizingModelState.extend = function(geo, next)
	{
		var ms = new ModelStates.VoxelizingModelState(next.voxparams);
		ms.geometry = geo;
		ms.grid = next.grid.clone();
		geo.voxelize(ms.grid, ms.voxparams.bounds, ms.grid.dims, true);
		ms.bbox = geo.getbbox().clone().union(next.bbox);
		ms.next = next;
		ms.length = 1 + next.length;
		return ms;
	}

	ModelStates.VoxelizingModelState.prototype = 
	{
		constructor: ModelStates.VoxelizingModelState,

		addGeometry: function(geo)
		{
			var newstate = ModelStates.VoxelizingModelState.extend(geo, this);
			var percentSame = this.voxparams.targetGrid.percentCellsEqualPadded(newstate.grid);
			var targetExtent = voxparams.bounds.size();
			var extralo = voxparams.bounds.min.clone().sub(newstate.bbox.min).clampScalar(0, Infinity).divide(targetExtent);
			var extrahi = newstate.bbox.max.clone().sub(voxparams.bounds.max).clampScalar(0, Infinity).divide(targetExtent);
			var percentOutside = extralo.x + extralo.y + extralo.z + extrahi.x + extrahi.y + extrahi.z;
			newstate.score = gaussianERP.score([1, 0.02], percentSame) + gaussianERP.score([0, 0.02], percentOutside);
			return newstate;
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