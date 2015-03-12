var Intersection = (function(){

	var Intersection = {};

	// ------------------------------------------------------------------------

	// TODO(?): These functions generate a lot of garbage. If this slows things down,
	//    try to make their tmp vars be persistent globals?

	// Returns 1 if intersects; 0 if front, -1 if back
	var BOX_PLANE_EPSILON = 0.00001
	function intersectBoxPlane(bmins, bmaxs, pdist, pnorm)
	{
		var center = bmins.clone().add(bmaxs).multiplyScalar(0.5);
		var extent = bmaxs.clone().sub(center);
		var fOrigin = pnorm.dot(center);
		var pnormabs = pnorm.clone();
		pnormabs.x = Math.abs(pnormabs.x);
		pnormabs.y = Math.abs(pnormabs.y);
		pnormabs.z = Math.abs(pnormabs.z);
		var fMaxExtent = extent.dot(pnormabs);
		var fmin = fOrigin - fMaxExtent
		var fmax = fOrigin + fMaxExtent;
		if (pdist > fmax + BOX_PLANE_EPSILON)
			return -1;
		else if (pdist + BOX_PLANE_EPSILON >= fmin)
			return 1;
		else
			return 0;
	}

	// TODO(?): Make these macros using e.g. http://sweetjs.org/
	function TEST_CROSS_EDGE_BOX_MCR(edge,absolute_edge,pointa,pointb,extend,i_dir_0,i_dir_1,i_comp_0,i_comp_1)
	{
		var dir0 = -edge[i_dir_0];
		var dir1 = edge[i_dir_1];
		var pmin = pointa[i_comp_0]*dir0 + pointa[i_comp_1]*dir1;
		var pmax = pointb[i_comp_0]*dir0 + pointb[i_comp_1]*dir1;
		if (pmin>pmax)
		{
			// swap
			var tmp = pmin;
			pmin = pmax;
			pmax = tmp;
		}
		var abs_dir0 = absolute_edge[i_dir_0];
		var abs_dir1 = absolute_edge[i_dir_1];
		var rad = extend[i_comp_0]*abs_dir0 + extend[i_comp_1]*abs_dir1;
		if (pmin>rad || -rad>pmax)
			return false;
	}
	function TEST_CROSS_EDGE_BOX_X_AXIS_MCR(edge,absolute_edge,pointa,pointb,extend)
	{
		return TEST_CROSS_EDGE_BOX_MCR(edge,absolute_edge,pointa,pointb,extend,'z','y','y','z');
	}
	function TEST_CROSS_EDGE_BOX_Y_AXIS_MCR(edge,absolute_edge,pointa,pointb,extend)
	{
		return TEST_CROSS_EDGE_BOX_MCR(edge,absolute_edge,pointa,pointb,extend,'x','z','z','x');
	}
	function TEST_CROSS_EDGE_BOX_Z_AXIS_MCR(edge,absolute_edge,pointa,pointb,extend)
	{
		return TEST_CROSS_EDGE_BOX_MCR(edge,absolute_edge,pointa,pointb,extend,'y','x','x','y');
	}

	Intersection.intersectTriangleBBox = function(bmins, bmaxs, p0, p1, p2)
	{
		var pnorm = p1.clone().sub(p0).cross(p2.clone().sub(p0)).normalize();
		var pdist = pnorm.dot(p0);
		if (pdist < 0.0)
		{
			pdist = -pdist;
			pnorm.negate();
		}
		if (intersectBoxPlane(bmins, bmaxs, pdist, pnorm) !== 1)
			return false;
		var center = bmins.clone().add(bmaxs).multiplyScalar(0.5);
		var extent = bmaxs.clone().sub(center);
		var v1 = p0.clone().sub(center);
		var v2 = p1.clone().sub(center);
		var v3 = p2.clone().sub(center);
		// First
		var diff = v2.clone().sub(v1);
		var abs_diff = diff.clone();
		abs_diff.x = Math.abs(abs_diff.x); abs_diff.y = Math.abs(abs_diff.y); abs_diff.z = Math.abs(abs_diff.z);
		if (!TEST_CROSS_EDGE_BOX_X_AXIS_MCR(diff,abs_diff,v1,v3,extent))
			return false;
		if (!TEST_CROSS_EDGE_BOX_Y_AXIS_MCR(diff,abs_diff,v1,v3,extent))
			return false;
		if (!TEST_CROSS_EDGE_BOX_Z_AXIS_MCR(diff,abs_diff,v1,v3,extent))
			return false;
		// Second
		diff.copy(v3).sub(v2);
		abs_diff.set(Math.abs(diff.x), Math.abs(diff.y), Math.abs(diff.z));
		if (!TEST_CROSS_EDGE_BOX_X_AXIS_MCR(diff,abs_diff,v2,v1,extent))
			return false;
		if (!TEST_CROSS_EDGE_BOX_Y_AXIS_MCR(diff,abs_diff,v2,v1,extent))
			return false;
		if (!TEST_CROSS_EDGE_BOX_Z_AXIS_MCR(diff,abs_diff,v2,v1,extent))
			return false;
		// Third
		diff.copy(v1).sub(v3);
		abs_diff.set(Math.abs(diff.x), Math.abs(diff.y), Math.abs(diff.z));
		if (!TEST_CROSS_EDGE_BOX_X_AXIS_MCR(diff,abs_diff,v3,v2,extent))
			return false;
		if (!TEST_CROSS_EDGE_BOX_Y_AXIS_MCR(diff,abs_diff,v3,v2,extent))
			return false;
		if (!TEST_CROSS_EDGE_BOX_Z_AXIS_MCR(diff,abs_diff,v3,v2,extent))
			return false;

		return true;
	}

	// ------------------------------------------------------------------------

	return Intersection;

})();


