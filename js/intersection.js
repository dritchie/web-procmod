var Intersection = (function(){

	var Intersection = {};

	// ------------------------------------------------------------------------

	// Box-triangle intersection

	// Returns 1 if intersects; 0 if front, -1 if back
	var intersectBoxPlane = (function() {
		var BOX_PLANE_EPSILON = 0.00001;
		var center = new THREE.Vector3();
		var extent = new THREE.Vector3();
		var pnormabs = new THREE.Vector3();
		return function(bmins, bmaxs, pdist, pnorm)
		{
			center.copy(bmins).add(bmaxs).multiplyScalar(0.5);
			extent.copy(bmaxs).sub(center);
			var fOrigin = pnorm.dot(center);
			pnormabs.copy(pnorm);
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
	})();

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
		return true;
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

	Intersection.intersectTriangleBBox = (function() {
		var p1mp0 = new THREE.Vector3();
		var p2mp0 = new THREE.Vector3();
		var pnorm = new THREE.Vector3();
		var center = new THREE.Vector3();
		var extent = new THREE.Vector3();
		var v1 = new THREE.Vector3();
		var v2 = new THREE.Vector3();
		var v3 = new THREE.Vector3();
		var diff = new THREE.Vector3();
		var abs_diff = new THREE.Vector3();
		return function(bmins, bmaxs, p0, p1, p2)
		{
			pnorm.copy(p1mp0.copy(p1).sub(p0).cross(p2mp0.copy(p2).sub(p0))).normalize();
			var pdist = pnorm.dot(p0);
			if (pdist < 0.0)
			{
				pdist = -pdist;
				pnorm.negate();
			}
			if (intersectBoxPlane(bmins, bmaxs, pdist, pnorm) !== 1)
				return false;
			center.copy(bmins).add(bmaxs).multiplyScalar(0.5);
			extent.copy(bmaxs).sub(center);
			v1.copy(p0).sub(center);
			v2.copy(p1).sub(center);
			v3.copy(p2).sub(center);
			// First
			diff.copy(v2).sub(v1);
			abs_diff.copy(diff);
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
	})();

	// ------------------------------------------------------------------------

	// Triangle-triangle intersection

	function EDGE_EDGE_TEST(v0, u0, u1, i0, i1, ax, ay)
	{
		var bx = u0[i0] - u1[i0];
		var by = u0[i1] - u1[i1];
		var cx = v0[i0] - u0[i0];
		var cy = v0[i1] - u0[i1];
		var d = by*cx - bx*cy;
		var f = ay*bx - ax*by;
		if ((f > 0 && d >= 0 && d <= f) || (f < 0 && d <=0 && d >= f))
		{
			var e = ax*cy - ay*cx;
			if (f > 0)
			{
				if (e >= 0 && e <= f)
					return true;
			}
			else
			{
				if (e <= 0 && e >= f)
					return true;
			}
		}
		return false;
	}

	function EDGE_AGAINST_TRI_EDGES(v0, v1, u0, u1, u2, i0, i1)
	{
		var ax = v1[i0] - v0[i0];
		var ay = v1[i1] - v0[i1];
		if (EDGE_EDGE_TEST(v0, u0, u1, i0, i1, ax, ay)) return true;
		if (EDGE_EDGE_TEST(v0, u1, u2, i0, i1, ax, ay)) return true;
		if (EDGE_EDGE_TEST(v0, u2, u0, i0, i1, ax, ay)) return true;
		return false;
	}

	function POINT_IN_TRI(v0, u0, u1, u2, i0, i1)
	{
		var a, b, c, d0, d1, d2;
		a = u1[i1] - u0[i1];
		b = -(u1[i0] - u0[i0]);
		c = -a*u0[i0] - b*u0[i1];
		d0 = a*v0[i0] + b*v0[i1] + c;
		a = u2[i1] - u1[i1];
		b = -(u2[i0] - u1[i0]);
		c = -a*u1[i0] - b*u1[i1];
		d1 = a*v0[i0] + b*v0[i1] + c;
		a = u0[i1] - u2[i1];
		b = -(u0[i0] - u2[i0]);
		c = -a*u2[i0] - b*u2[i1];
		d2 = a*v0[i0] + b*v0[i1] + c;
		if (d0*d1 > 0)
			if (d0*d2 > 0) return true;
		return false;
	}

	function coplanar_tri_tri(n, v0, v1, v2, u0, u1, u2)
	{
		var i0, i1;
		var ax = Math.abs(n.x);
		var ay = Math.abs(n.y);
		var az = Math.abs(n.z);
		if (ax > ay)
		{
			if (ax > az)
			{
				i0 = 'y';
				i1 = 'z';
			}
			else
			{
				i0 = 'x';
				i1 = 'y';
			}
		}
		else
		{
			if (az > ax)
			{
				i0 = 'x';
				i1 = 'y';
			}
			else
			{
				i0 = 'x';
				i1 = 'z';
			}
		}
		// Test all edges of triangle 1 against all edges of triangle 2
		if (EDGE_AGAINST_TRI_EDGES(v0, v1, u0, u1, u2, i0, i1)) return true;
		if (EDGE_AGAINST_TRI_EDGES(v1, v2, u0, u1, u2, i0, i1)) return true;
		if (EDGE_AGAINST_TRI_EDGES(v2, v0, u0, u1, u2, i0, i1)) return true;
		// Test if either triangle is totally contained in the other
		if (POINT_IN_TRI(v0, u0, u1, u2, i0, i1)) return true;
		if (POINT_IN_TRI(u0, v0, v1, v2, i0, i1)) return true;
		return false;
	}

	function NEWCOMPUTE_INTERVALS(vv0, vv1, vv2, d0, d1, d2, d0d1, d0d2, abc, x0x1)
	{
		if (d0d1 > 0)
		{
			abc.x = vv2; abc.y = (vv0 - vv2)*d2; abc.z = (vv1 - vv2)*d2; x0x1.x = d2 - d0; x0x1.y = d2 - d1;
		}
		else if (d0d2 > 0)
		{
			abc.x = vv1; abc.y = (vv0 - vv1)*d1; abc.z = (vv2 - vv1)*d1; x0x1.x = d1 - d0; x0x1.y = d1 - d2;
		}
		else if (d1*d2 > 0 || d0 !== 0)
		{
			abc.x = vv0; abc.y = (vv1 - vv0)*d0; abc.z = (vv2 - vv0)*d0; x0x1.x = d0 - d1; x0x1.y = d0 - d2;
		}
		else if (d1 !== 0)
		{
			abc.x = vv1; abc.y = (vv0 - vv1)*d1; abc.z = (vv2 - vv1)*d1; x0x1.x = d1 - d0; x0x1.y = d1 - d2;
		}
		else if (d2 !== 0)
		{
			abc.x = vv2; abc.y = (vv0 - vv2)*d2; abc.z = (vv1 - vv2)*d2; x0x1.x = d2 - d0; x0x1.y = d2 - d1;
		}
		else
			return true;		// Triangles are coplanar
		return false;
	}

	Intersection.intersectTriangleTriangle = (function() {
		var EPSILON = 0.000001;
		var e1 = new THREE.Vector3();
		var e2 = new THREE.Vector3();
		var n1 = new THREE.Vector3();
		var n2 = new THREE.Vector3();
		var D = new THREE.Vector3();
		var abc = new THREE.Vector3();
		var x0x1 = new THREE.Vector2();
		var def = new THREE.Vector3();
		var y0y1 = new THREE.Vector2();
		return function(v0, v1, v2, u0, u1, u2, coplanarCounts, fudgeFactor)
		{
			// Compute plane equation of triangle v0, v1, v2 (n1.x + d1 = 0)
			e1.copy(v1).sub(v0);
			e2.copy(v2).sub(v0);
			n1.copy(e1).cross(e2);
			var d1 = -(n1.dot(v0))
			// Put u0, u1, u2 into plane equation to compute signed dists to the plane
			var du0 = n1.dot(u0) + d1;
			var du1 = n1.dot(u1) + d1;
			var du2 = n1.dot(u2) + d1;
			// Coplanarity robustness check
			if (Math.abs(du0) < EPSILON) du0 = 0;
			if (Math.abs(du1) < EPSILON) du1 = 0;
			if (Math.abs(du2) < EPSILON) du2 = 0;
			// Same sign on all + not equal 0 --> no intersection
			var du0du1 = du0*du1;
			var du0du2 = du0*du2;
			if (du0du1 >= 0 && du0du2 >= 0) return false;
			// Compute plane equation of triangle u0, u1, u2 (n2.x + d2 = 0)
			e1.copy(u1).sub(u0);
			e2.copy(u2).sub(u0);
			n2.copy(e1).cross(e2);
			var d2 = -(n2.dot(u0));
			// Put v0, v1, v2 into plane equation to compute signed dists to the plane
			var dv0 = n2.dot(v0) + d2;
			var dv1 = n2.dot(v1) + d2;
			var dv2 = n2.dot(v2) + d2;
			// Coplanarity robustness check
			if (Math.abs(dv0) < EPSILON) dv0 = 0.0;
			if (Math.abs(dv1) < EPSILON) dv1 = 0.0;
			if (Math.abs(dv2) < EPSILON) dv2 = 0.0;
			// Same sign on all + not equal 0 --> no intersection
			var dv0dv1 = dv0*dv1;
			var dv0dv2 = dv0*dv2;
			if (dv0dv1 >= 0 && dv0dv2 >= 0) return false;
			// Compute direction of intersection line
			D.copy(n1).cross(n2);
			// Compute index to largest component of D
			var max = Math.abs(D.x);
			var index = 'x';
			var bb = Math.abs(D.y);
			var cc = Math.abs(D.z);
			if (bb > max) { max = bb; index = 'y'; }
			if (cc > max) { max = cc; index = 'z'; }
			// Simplified projection onto intersection line L
			var vp0 = v0[index];
			var vp1 = v1[index];
			var vp2 = v2[index];
			var up0 = u0[index];
			var up1 = u1[index];
			var up2 = u2[index];
			// Compute interval for triangle 1
			if (NEWCOMPUTE_INTERVALS(vp0, vp1, vp2, dv0, dv1, dv2, dv0dv1, dv0dv2, abc, x0x1))
			{
				if (coplanarCounts)
					return coplanar_tri_tri(n1, v0, v1, v2, u0, u1, u2);
				else
					return false;
			}
			var a = abc.x; var b = abc.y; var c = abc.z;
			var x0 = x0x1.x; var x1 = x0x1.y;
			if (NEWCOMPUTE_INTERVALS(up0, up1, up2, du0, du1, du2, du0du1, du0du2, def, y0y1))
			{
				if (coplanarCounts)
					return coplanar_tri_tri(n1, v0, v1, v2, u0, u1, u2);
				else
					return false;
			}
			var d = def.x; var e = def.y; var f = def.z;
			var y0 = y0y1.x; var y1 = y0y1.y;
			// Finish up with non-coplanar intersection
			var xx, yy, xxyy, tmp;
			xx = x0*x1;
			yy = y0*y1;
			xxyy = xx*yy;
			var isec1x, isec1y, isect2x, isect2y;
			tmp = a*xxyy;
			isect1x = tmp + b*x1*yy;
			isect1y = tmp + c*x0*yy;
			tmp = d*xxyy;
			isect2x = tmp + e*xx*y1;
			isect2y = tmp + f*xx*y0;
			// Sort isects
			if (isect1x > isect1y)
			{
				var tmp = isect1x;
				isect1x = isect1y;
				isect1y = tmp;
			}
			if (isect2x > isect2y)
			{
				var tmp = isect2x;
				isect2x = isect2y;
				isect2y = tmp;
			}
			if ((isect1y <= isect2x + fudgeFactor) || (isect2y <= isect1x + fudgeFactor)) return false;
			return true;
		}
	})();

	// ------------------------------------------------------------------------

	return Intersection;

})();



