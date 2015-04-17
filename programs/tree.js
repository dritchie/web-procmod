
var N_SEGS = 10;
var worldup = new THREE.Vector3(0, 1, 0);


var lerp = function(lo, hi, t) { return (1-t)*lo + t*hi; };


// ----------------------------------------------------------------------------


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
		p3.copy(startFrame.v).lerp(endFrame.v, t);
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
};

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

module.exports = {
	findSplitFrame: findSplitFrame,
	estimateThetaDistrib: estimateThetaDistrib,
	continueProb: continueProb,
	branchProb: branchProb
};