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
			var newstate = this;
			// We don't even bother updating the state if the score is already -Infinity.
			// (This is sort of like bailing out early: the program runs to completion, but
			//   it doesn't do any of the really expensive stuff).
			if (this.score > -Infinity)
			{
				newstate = ModelStates.VoxelizingModelState.extend(geo, this);
				// If adding this new geometry results in a self-intersection, then
				//    the score immediately drops to log(0).
				if (this.intersects(geo))
					newstate.score = -Infinity;
				else
				{
					var vp = this.voxparams;
					var percentSame = vp.targetGrid.percentCellsEqualPadded(newstate.grid);
					var targetExtent = vp.bounds.size();
					var extralo = vp.bounds.min.clone().sub(newstate.bbox.min).clampScalar(0, Infinity).divide(targetExtent);
					var extrahi = newstate.bbox.max.clone().sub(vp.bounds.max).clampScalar(0, Infinity).divide(targetExtent);
					var percentOutside = extralo.x + extralo.y + extralo.z + extrahi.x + extrahi.y + extrahi.z;
					newstate.score = gaussianERP.score([1, vp.percentSameSigma], percentSame) +
									 gaussianERP.score([0, vp.percentOutsideSigma], percentOutside);
				}
			}
			return newstate;
		},

		// The linear chain of states acts like a one-dimesional BVH.
		intersects: function(geo)
		{
			var geobbox = geo.getbbox();
			// Walk down the chain of states, looking for intersections.
			for (var currstate = this; currstate !== null; currstate = currstate.next)
			{
				// If at any point the new geo's bbox no longer intersects the accumulated state
				//    bbox, we can bail out with a false.
				if (!geobbox.isIntersectionBox(currstate.bbox))
					return false;
				// If we find an intersection, bail out with a true.
				if (geo.intersects(currstate.geometry))
					return true;
			}
			return false;
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



