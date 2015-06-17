// Geometric primitives specific to spaceships

var SpaceshipGeo = (function() {

	var N_CYLINDER = 8;

	var mrot = new THREE.Matrix4();
	mrot.makeRotationX(Math.PI/2);
	var m1 = new THREE.Matrix4();
	var m2 = new THREE.Matrix4();
	var BodyCylinder = function(zbase, length, baseRadius, tipRadius)
	{
		m1.makeTranslation(0, 0, 0.5*length+zbase);
		m2.makeTranslation(0, -0.5*length, 0);
		m1.multiply(mrot).multiply(m2);
		var cyl = Geo.Shapes.Cylinder(0, 0, 0, length, N_CYLINDER, baseRadius, tipRadius);
		cyl.transform(m1);
		return cyl;
	}

	var m3 = new THREE.Matrix4();
	var m4 = new THREE.Matrix4();
	var BodyCluster = function(zbase, length, radius)
	{
		var cyl = Geo.Shapes.Cylinder(0, 0, 0, length, N_CYLINDER, radius);
		var geo = new Geo.Geometry();
		m1.makeTranslation(0, 0, 0.5*length+zbase);
		m2.makeTranslation(0, -0.5*length, 0);
		m1.multiply(mrot).multiply(m2);
		// 1
		m3.makeTranslation(-radius, 0, -radius);
		m4.copy(m1).multiply(m3);
		geo.mergeWithTransform(cyl, m4);
		// 2
		m3.makeTranslation(-radius, 0, radius);
		m4.copy(m1).multiply(m3);
		geo.mergeWithTransform(cyl, m4);
		// 3
		m3.makeTranslation(radius, 0, -radius);
		m4.copy(m1).multiply(m3);
		geo.mergeWithTransform(cyl, m4);
		// 4
		m3.makeTranslation(radius, 0, radius);
		m4.copy(m1).multiply(m3);
		geo.mergeWithTransform(cyl, m4);
		return geo;
	}

	var WingBoxes = function(xbase, zbase, xlen, ylen, zlen)
	{
		// Left
		var wings = Geo.Shapes.Box(xbase+0.5*xlen, 0, zbase, xlen, ylen, zlen);
		// Right
		wings.addBox(-(xbase+0.5*xlen), 0, zbase, xlen, ylen, zlen);
		return wings;
	}

	var WingCylinders = function(xbase, zbase, length, radius)
	{
		var cyl = Geo.Shapes.Cylinder(0, 0, 0, length, N_CYLINDER, radius);
		var geo = new Geo.Geometry();
		m1.makeTranslation(0, -.5*length, 0);
		m2.copy(mrot).multiply(m1);
		// Left
		m3.makeTranslation(-xbase - radius, 0, zbase).multiply(m2);
		geo.mergeWithTransform(cyl, m3);
		// Right
		m3.makeTranslation(xbase + radius, 0, zbase).multiply(m2);
		geo.mergeWithTransform(cyl, m3);
		return geo;
	}

	var gunRadius = .15;
	var tipRadius = .03;
	var tipLength = .4;
	var WingGuns = function(xbase, ybase, zbase, length)
	{
		var gunproto = Geo.Shapes.Cylinder(0, 0, 0, length, N_CYLINDER, gunRadius);
		gunproto.addCylinder(0, length, 0, tipLength, N_CYLINDER, gunRadius, tipRadius);
		var geo = new Geo.Geometry();
		m1.makeTranslation(0, -.5*length, 0);
		m2.copy(mrot).multiply(m1);
		// 1
		m3.makeTranslation(-xbase, -ybase-gunRadius, zbase).multiply(m2);
		geo.mergeWithTransform(gunproto, m3);
		// 2
		m3.makeTranslation(-xbase, ybase+gunRadius, zbase).multiply(m2);
		geo.mergeWithTransform(gunproto, m3);
		// 3
		m3.makeTranslation(xbase, -ybase-gunRadius, zbase).multiply(m2);
		geo.mergeWithTransform(gunproto, m3);
		// 4
		m3.makeTranslation(xbase, ybase+gunRadius, zbase).multiply(m2);
		geo.mergeWithTransform(gunproto, m3);
		return geo;
	}

	return {
		BodyCylinder: BodyCylinder,
		BodyCluster: BodyCluster,
		WingBoxes: WingBoxes,
		WingCylinders: WingCylinders,
		WingGuns: WingGuns
	}

})();




