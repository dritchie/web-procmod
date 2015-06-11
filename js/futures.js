
// Stochastic ordering
function sfuture(s, k, a, fn)
{
	if (s.__futures === undefined)
		s.__futures = [];
	var future = function(s, k)
	{
		// Use the address from the future's creation point
		return fn(s, k, a);
	}
	s.__futures = s.__futures.slice();
	s.__futures.push(future);
	return k(s, future);
}

// Deterministic, depth-first ordering
function dfuture(s, k, a, fn)
{
	return fn(s, k, a);
}

// We default to using stochastic futures
future = sfuture;

// Switch what type of future is being used
function setFuturePolicy(s, k, a, policyname) {
	if (policyname == 'stochastic') {
		future = sfuture;
	} else if (policyname == 'deterministic') {
		future = dfuture;
	} else
		throw 'Unknown future policy ' + policyname;
	return k(s);
}

function force(s, k, a, future)
{
	var i = s.__futures.indexOf(future);
	s.__futures = globalStore.__futures.slice();
	s.__futures.splice(i, 1);
	return future(s, k);
}

function finishall(s, k, a)
{
	if (s.__futures !== undefined && s.__futures.length > 0)
	{
		return sample(s, function(s, i)
		{
			var future = s.__futures[i];
			s.__futures = s.__futures.slice();
			s.__futures.splice(i, 1);
			return future(s, function(s)
			{
				return finishall(s, k, a);
			});
		}, a, randomIntegerERP, [s.__futures.length]);
	}
	else return k(s);
}


// ----------------------------------------------------------------------------

// Here is the WebPPL version of the above. We don't use this because it doesn't
//    handle addresses correctly in the presence of futures, which means that you
//    can't use MH with a futurized program.

// // Stochastic ordering
// var future = function(fn)
// {
// 	if (globalStore.__futures === undefined)
// 		globalStore.__futures = [];
// 	globalStore.__futures = globalStore.__futures.concat([fn]);
// 	return fn;
// }

// // // Depth-first ordering
// // var future = function(fn)
// // {
// // 	return fn();
// // }

// var force = function(future)
// {
// 	var i = globalStore.__futures.indexOf(future);
// 	globalStore.__futures = globalStore.__futures.slice();
// 	globalStore.__futures.splice(i, 1);
// 	return future();
// }

// var finishall = function()
// {
// 	if (globalStore.__futures !== undefined)
// 	{
// 		if (globalStore.__futures.length > 0)
// 		{
// 			var i = randomInteger(globalStore.__futures.length);
// 			var future = globalStore.__futures[i];
// 			globalStore.__futures = globalStore.__futures.slice();
// 			globalStore.__futures.splice(i, 1);
// 			future();
// 			finishall();
// 		}
// 	}
// }
