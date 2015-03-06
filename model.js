THREE.Geometry.prototype.combine = function(other)
{
	if (other !== null)
	{
		var g = this.clone();
		g.merge(other);
		return g;
	}
	else return this;
}

genGeometry = (function()
{
	function flip(p)
	{
		return Math.random() < p;
	}

	function uniform(lo, hi)
	{
		var x = Math.random();
		return (1-x)*lo + x*hi;
	}


	// ----------------------------------------------------------------

	var dospacing = true;
	var eps = 0;
	if (dospacing) { eps = 0.005; }


	function genShip(rearz)
	{
		return _genShip(new THREE.Geometry(), 0, rearz);
	}
	function _genShip(geo, i, rearz)
	{
		// Gen new body segment
		var rets = genBodySeg(rearz);
		var xlen = rets.xlen;
		var ylen = rets.ylen;
		var zlen = rets.zlen;
		var newgeo1 = geo.combine(rets.bodygeo);
		var wingprob = wi(i+1, 0.5);
		// Gen wings?
		var newgeo2 = flip(wingprob) ?
							addWings(newgeo1, 0, 0.5*xlen+eps, rearz+0.5, rearz+zlen-0.5)
							:
							newgeo1;
		// // Gen fin?
		// var finprob = 0.7;
		// var newgeo3 = flip(finprob) ?
		// 					addFin(newgeo2, 0, 0.5*ylen, rearz, rearz+zlen, 0.6*xlen)
		// 					:
		// 					newgeo2;
		var newgeo3 = newgeo2;
		// Continue generating?
		if (flip(wi(i, 0.4)))
			return _genShip(newgeo3, i+1, rearz+zlen+eps);
		else
			return newgeo3;
	}

	function wi(i, w) { return Math.exp(-w*i); }

	function genBodySeg(rearz)
	{
		var xlen = uniform(1, 3);
		var ylen = uniform(.5, 1) * xlen;
		var zlen = uniform(2, 5);
		var bodygeo = new THREE.BoxGeometry(xlen, ylen, zlen);
		var mat = new THREE.Matrix4();
		mat.makeTranslation(0, 0, rearz + 0.5*zlen);
		bodygeo.applyMatrix(mat);
		return { xlen: xlen, ylen: ylen, zlen: zlen, bodygeo: bodygeo };
	}

	function addWings(geo, i, xbase, zlo, zhi)
	{
		var rets = genWingSeg(xbase, zlo, zhi);
		var xlen = rets.xlen;
		var ylen = rets.ylen;	
		var zlen = rets.zlen;
		var zbase = rets.zbase;
		var newgeo = geo.combine(rets.winggeo);
		if (flip(wi(i, 0.6)))
			return addWings(newgeo, i+1, xbase+xlen+eps, zbase-0.5*zlen, zbase+0.5*zlen);
		else
			return newgeo;
	}

	function genWingSeg(xbase, zlo, zhi)
	{
		var zbase = uniform(zlo, zhi);
		var xlen = uniform(0.25, 2.0);
		var ylen = uniform(0.25, 1.25);
		var zlen = uniform(0.5, 4.0);
		var winggeo1 = new THREE.BoxGeometry(xlen, ylen, zlen);
		var mat = new THREE.Matrix4();
		mat.makeTranslation(xbase+0.5*xlen, 0, zbase);
		winggeo1.applyMatrix(mat);
		var winggeo2 = new THREE.BoxGeometry(xlen, ylen, zlen);
		mat.makeTranslation(-(xbase + 0.5*xlen), 0, zbase);
		winggeo2.applyMatrix(mat);
		winggeo1.merge(winggeo2);
		return { xlen: xlen, ylen: ylen, zlen: zlen, zbase: zbase, winggeo: winggeo1 }
	}


	// ----------------------------------------------------------------


	return function()
	{
		// return new THREE.BoxGeometry( 1, 1, 1 );
		return genShip(-5);
	};
})();




