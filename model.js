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
							addWings(newgeo1, 0, 0.5*xlen, rearz+0.5, rearz+zlen-0.5)
							:
							newgeo1;
		// Gen fin?
		var finprob = 0.7;
		var newgeo3 = flip(finprob) ?
							addFin(newgeo2, 0, 0.5*ylen, rearz, rearz+zlen, 0.6*xlen)
							:
							newgeo2;
		// Continue generating?
		if (flip(wi(i, 0.4)))
			return _genShip(newgeo3, i+1, rearz+zlen);
		else
			return newgeo3;
	}

	function wi(i, w) { return Math.exp(-w*i); }

	function genBodySeg(rearz)
	{
		var xlen = uniform(1, 3);
		var ylen = uniform(.5, 1) * xlen;
		var zlen = uniform(2, 5);
		var bodygeo = box(0, 0, rearz + 0.5*zlen, xlen, ylen, zlen);
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
			return addWings(newgeo, i+1, xbase+xlen, zbase-0.5*zlen, zbase+0.5*zlen);
		else
			return newgeo;
	}

	function genWingSeg(xbase, zlo, zhi)
	{
		var zbase = uniform(zlo, zhi);
		var xlen = uniform(0.25, 2.0);
		var ylen = uniform(0.25, 1.25);
		var zlen = uniform(0.5, 4.0);
		var winggeo1 = box(xbase+0.5*xlen, 0, zbase, xlen, ylen, zlen);
		var winggeo2 = box(-(xbase + 0.5*xlen), 0, zbase, xlen, ylen, zlen);
		winggeo1.merge(winggeo2);
		return { xlen: xlen, ylen: ylen, zlen: zlen, zbase: zbase, winggeo: winggeo1 }
	}

	function addFin(geo, i, ybase, zlo, zhi, xmax)
	{
		var xlen = uniform(0.5, 1.0) * xmax;
		var ylen = uniform(0.1, 0.5);
		var zlen = uniform(0.5, 1.0) * (zhi - zlo);
		var zbase = 0.5*(zlo + zhi);
		var fingeo = box(0, ybase + 0.5*ylen, zbase, xlen, ylen, zlen);
		var newgeo = geo.combine(fingeo);
		if (flip(wi(i, 0.2)))
			return addFin(newgeo, i+1, ybase+ylen, zbase-0.5*zlen, zbase+0.5*zlen, xlen);
		else
			return newgeo;
	}

	function box(x, y, z, xlen, ylen, zlen)
	{
		var b = new THREE.BoxGeometry(xlen, ylen, zlen);
		var m = new THREE.Matrix4();
		m.makeTranslation(x, y, z);
		b.applyMatrix(m);
		return b;
	}


	// ----------------------------------------------------------------


	return function()
	{
		// return new THREE.BoxGeometry( 1, 1, 1 );
		return genShip(-5);
	};
})();




