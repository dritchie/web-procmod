
var tree = function() {

	var N_SEGS = 10;
	// var N_SEGS = 34;
	var OUTRADIUS_FACTOR = Math.cos(Math.PI/N_SEGS);
	var worldup = new THREE.Vector3(0, 1, 0);
	var WORLD_TO_TEX = 0.15

	if (N_SEGS < 6 || (N_SEGS-2)%4 !== 0)
		throw "N_SEGS must be one of 6, 10, 14, 18, ...";


	// ----------------------------------------------------------------------------


	var lerp = function(lo, hi, t) { return (1-t)*lo + t*hi; };

	THREE.Matrix4.prototype.makePivot = function() {
		var m1 = new THREE.Matrix4();
		var m2 = new THREE.Matrix4();
		return function (axis, angle, center) {
			m1.makeTranslation(-center.x, -center.y, -center.z);
			m2.makeRotationAxis(axis, angle);
			this.makeTranslation(center.x, center.y, center.z);
			this.multiply(m2);
			this.multiply(m1);
			return this;
		};
	}();

	THREE.Vector3.prototype.inverseLerp = function() {
		var d = new THREE.Vector3();
		var tmp = new THREE.Vector3();
		return function (p0, p1) {
			d.copy(p1).sub(p0);
			var dnorm = d.lengthSq();
			return tmp.copy(this).sub(p0).dot(d) / dnorm;
		};
	}();

	THREE.Vector3.prototype.projectOnLineSeg = function() {
		var d = new THREE.Vector3();
		var tmp = new THREE.Vector3();
		return function (p0, p1) {
			d.copy(p1).sub(p0).normalize();
			var s = tmp.copy(this).sub(p0).dot(d);
			d.multiplyScalar(s);
			this.copy(d).add(p0);
			return this;	
		};
	}();


	// ----------------------------------------------------------------------------


	var circleOfVerts = function() {
		var m = new THREE.Matrix4();
		var rotamt = 2*Math.PI/N_SEGS;
		return function (geo, frame) {
			var v = frame.up.clone().multiplyScalar(frame.radius)
						 .add(frame.center);
			geo.vertices.push(v);
			geo.uvs.push(new THREE.Vector2(0, frame.v));
			// geo.merge(Geo.Shapes.Box(v.x, v.y, v.z, .2, .2, .2));
			m.makePivot(frame.forward, rotamt, frame.center);
			for (var i = 1; i < N_SEGS + 1; i++) {
				v = v.clone().applyMatrix4(m);
				// geo.merge(Geo.Shapes.Box(v.x, v.y, v.z, .2, .2, .2));
				geo.vertices.push(v);
				geo.uvs.push(new THREE.Vector2(i/N_SEGS, frame.v));
			}
			return N_SEGS + 1;
		};
	}();

	var cylinderSides = function(geo, bi) {
		for (var i = 0; i < N_SEGS; i++) {
			var i0 = i;
			var i1 = i + 1;
			var i2 = N_SEGS + 1 + i + 1;
			var i3 = N_SEGS + 1 + i;
			geo.indices.push(bi + i0);
			geo.indices.push(bi + i1);
			geo.indices.push(bi + i2);
			geo.indices.push(bi + i2);
			geo.indices.push(bi + i3);
			geo.indices.push(bi + i0);
		}
	};

	var cylinderCap = function(geo, bi) {
		var n = N_SEGS;
		var nStrips = (n - 2) / 2;
		for (var i = 0; i < nStrips / 2; i++) {
			Geo.Geometry.quad(geo, bi + i, bi + i+1, bi + (n/2)-i-1, bi + (n/2)-i);
		}
		for (var i = 0; i < nStrips / 2; i++) {
			Geo.Geometry.quad(geo, bi + (n/2)+i, bi + (n/2)+i+1, bi + n-i-1, bi + (n-i)%n);
		}
	};

	var weldCircleOfVerts = function() {
		var center = new THREE.Vector3();
		var d = new THREE.Vector3();
		var p = new THREE.Vector3();
		var offset = new THREE.Vector3();
		return function (geo, frame, prev) {
			center.copy(prev.p0).add(prev.p1).multiplyScalar(0.5);
			d.copy(center).sub(frame.center).normalize();
			var a = d.dot(d);
			for (var i = 0; i < N_SEGS + 1; i++) {
				var v = geo.vertices[i];
				p.copy(v).projectOnLineSeg(prev.p0, prev.p1);
				var t = p.inverseLerp(prev.p0, prev.p1);
				var radius = lerp(prev.r0, prev.r1, t);
				var r2 = radius * radius;
				var vmp = p.negate().add(v);	// p <- (v - p)
				var b = 2*d.dot(vmp);
				var c = vmp.dot(vmp) - r2;
				var disc = b*b - 4*a*c;
				if (disc < 0) disc = 0;
				disc = Math.sqrt(disc);
				var rayt = (-b - disc) / (2*a);
				v.add(offset.copy(d).multiplyScalar(rayt));
			}
		};
	}();

	var treeSegment = function (prev, frame0, frame1, frame2) {
		var geo = new Geo.Geometry();
		// Vertices 0,N_SEGS are the bottom outline of the base
		var nadded = circleOfVerts(geo, frame0);
		// Vertices N_SEGS+1,2*N_SEGS are the outline of the split frame
		circleOfVerts(geo, frame1);
		// Finally, we have the vertices of the end frame
		circleOfVerts(geo, frame2);
		// Add quads for the outside between base and split
		cylinderSides(geo, 0, 0);
		// Add quads for the outside between split and end
		cylinderSides(geo, nadded, nadded);
		// Finally, add quads across the bottom
		cylinderCap(geo, 0, 0);
		// ...and add quads across the top
		cylinderCap(geo, 2*nadded, 2*nadded);
		// Deal with the 'prev trunk radius' stuff by welding the first circle of verts to the parent branch
		if (prev) {
			weldCircleOfVerts(geo, frame0, prev);
		}
		return geo;
	};

	var advanceFrame = function() {
		var left = new THREE.Vector3();
		var uprotmat = new THREE.Matrix4();
		var leftrotmat = new THREE.Matrix4();
		return function (frame, uprot, leftrot, len, endradius) {
			var c = frame.center;
			var fwd = frame.forward;
			var up = frame.up;
			left.copy(up).cross(fwd);
			uprotmat.makeRotationAxis(up, uprot);
			leftrotmat.makeRotationAxis(left, leftrot);
			var newup = up.clone().transformDirection(leftrotmat);
			leftrotmat.multiply(uprotmat);
			var newfwd = fwd.clone().transformDirection(leftrotmat);
			var newc = newfwd.clone().multiplyScalar(len).add(c);
			var newv = frame.v + (WORLD_TO_TEX/frame.radius)*len;
			return {
				center: newc,
				forward: newfwd,
				up: newup,
				radius: endradius,
				v: newv
			};
		};
	}();

	var branchFrame = function() {
		var ct = new THREE.Vector3();
		var m = new THREE.Matrix4();
		var m1 = new THREE.Matrix4();
		var leftbf = new THREE.Vector3();
		return function (startFrame, endFrame, t, theta, radius) {
			// Construct the frame at the given t value
			ct.copy(startFrame.center).lerp(endFrame.center, t);
			var rt = lerp(startFrame.radius, endFrame.radius, t);
			// This is just the inradius; need to compute the outradius,
			//    since branches are polygonal approximations
			rt /= OUTRADIUS_FACTOR;

			// Construct the branch frame
			m.makePivot(endFrame.forward, theta, ct);
			m1.makePivot(endFrame.forward, theta, endFrame.center);
			var cbf = endFrame.up.clone().multiplyScalar(rt).add(ct).applyMatrix4(m);
			var upbf = endFrame.up.clone().multiplyScalar(endFrame.radius)
				                  .add(endFrame.center).applyMatrix4(m1)
				                  .sub(cbf).normalize();
			var fwdbf = cbf.clone().sub(ct).normalize();
			leftbf.copy(upbf).cross(fwdbf);
			fwdbf.copy(leftbf).cross(upbf);

			// Compute the effective radius of the parent branch at the
			//    extremes of this new branch frame
			var lopoint = upbf.clone().multiplyScalar(radius).negate().add(cbf).projectOnLineSeg(startFrame.center, endFrame.center);
			var lot = lopoint.inverseLerp(startFrame.center, endFrame.center);
			var hipoint = upbf.clone().multiplyScalar(radius).add(cbf).projectOnLineSeg(startFrame.center, endFrame.center);
			var hit = hipoint.inverseLerp(startFrame.center, endFrame.center);
			var loradius = lerp(startFrame.radius, endFrame.radius, lot);
			var hiradius = lerp(startFrame.radius, endFrame.radius, hit);
			// Also turn these into outradii
			loradius /= OUTRADIUS_FACTOR;
			hiradius /= OUTRADIUS_FACTOR;

			return {
				frame: {
					center: cbf,
					forward: fwdbf,
					up: upbf,
					radius: radius,
					v: 0	// Branches just start at v-origin in texture space
				},
				prev: {
					p0: lopoint,
					p1: hipoint,
					r0: loradius,
					r1: hiradius
				}
			};
		};
	}();

	var findSplitFrame = function() {
		var vzero = new THREE.Vector3(0, 0, 0);
		var v = new THREE.Vector3();
		var p0 = new THREE.Vector3();
		var p2 = new THREE.Vector3();
		var v2 = new THREE.Vector3();
		var p1 = new THREE.Vector3();
		var p3 = new THREE.Vector3();
		var tmp = new THREE.Vector3();
		return function (startFrame, endFrame) {
			v.copy(endFrame.forward).projectOnPlane(startFrame.forward).normalize().multiplyScalar(startFrame.radius);
			p0.copy(startFrame.center).sub(v);
			p2.copy(startFrame.center).add(v);
			v2.copy(v).projectOnPlane(endFrame.forward).normalize().multiplyScalar(endFrame.radius);
			p1.copy(endFrame.center).sub(v2);
			tmp.copy(p0).sub(p2).negate();
			var t1 = tmp.dot(endFrame.forward);
			tmp.copy(p1).sub(p0);
			var t2 = tmp.dot(endFrame.forward);
			var t = t1 / t2;
			p3.copy(p0).lerp(p1, t);
			var r = tmp.copy(p3).sub(p2).length() * 0.5;
			p2.add(tmp.copy(endFrame.forward).multiplyScalar(r * 0.1));
			var c = p2.clone().add(p3).multiplyScalar(0.5);
			var splitv = lerp(startFrame.v, endFrame.v, t);
			return {
				center: c,
				forward: endFrame.forward,
				up: endFrame.up,
				radius: r,
				v: splitv
			};
		}
	}();

	var estimateThetaDistrib = function() {
		var N_THETA_SAMPS = 8;
		var rotmat = new THREE.Matrix4();
		var v = new THREE.Vector3();
		return function (f0, f1) {
			rotmat.makeRotationAxis(f1.forward, 2 * Math.PI / N_THETA_SAMPS);
			v.copy(f1.up)
			var w = 0.5 * (v.dot(worldup) + 1);
			var minweight = w;
			var maxweight = w;
			var maxi = 0;
			for (var i=1; i <= N_THETA_SAMPS-1; i++) {
				v.applyMatrix4(rotmat);
				var w = 0.5 * (v.dot(worldup) + 1);
				minweight = Math.min(w, minweight);
				if (w > maxweight) {
					maxweight = w;
					maxi = i;
				}
			}
			var wdiff = maxweight - minweight;
			var stddev = lerp(Math.PI, Math.PI / 8, wdiff);
			return [2 * Math.PI * (maxi / N_THETA_SAMPS), stddev];
		};
	}();

	var continueProb = function(depth) { return Math.exp(-0.1*depth); };
	var branchProb = function(depth, i) { return 0.5; };


	// ----------------------------------------------------------------------------

	return {
		treeSegment: treeSegment,
		advanceFrame: advanceFrame,
		branchFrame: branchFrame,
		findSplitFrame: findSplitFrame,
		estimateThetaDistrib: estimateThetaDistrib,
		continueProb: continueProb,
		branchProb: branchProb
	};

}();