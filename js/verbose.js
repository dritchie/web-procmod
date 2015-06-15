var Verbose = (function() {

	var dialogstates = [];

	function createProgressDialog(name, title, width, hasCancel) {
		width = width || 300;
		hasCancel = hasCancel === undefined ? true : hasCancel;
		var state = {};

		var dialogname = name + '-dialog';
		var infotextname = name + '-infotext';
		var progressbarname = name + '-progressbar';

		// Create HTML elements
		state.dialog = document.createElement('div');
		state.dialog.setAttribute('id', dialogname);
		$('body').append(state.dialog);

		state.infotext = document.createElement('div');
		state.infotext.setAttribute('id', infotextname);
		$('#' + dialogname).append(state.infotext);

		state.progressbar = document.createElement('div');
		state.progressbar.setAttribute('id', progressbarname);
		$('#' + dialogname).append(state.progressbar);

		function cancel() {
			state.cancelled = true;
		}

		// Transform them into jquery-ui widgets
		state.dialog = $('#' + dialogname).dialog({
			dialogClass: 'no-close',
			autoOpen: false,
			closeOnEscape: false,
			resizable: false,
			draggable: false,
			modal: true,
			title: title,
			width: width,
			buttons: hasCancel ? [{text: 'Cancel', click: cancel}] : []
		});
		state.infotext = $('#' + infotextname);
		state.progressbar = $('#' + progressbarname).progressbar({});

		dialogstates.push(state);
		return state;
	}

	function createErrorDialog(name, title, width) {
		width = width || 300;
		var state = {};

		var dialogname = name + '-dialog';
		var infotextname = name + '-infotext';

		// Create HTML elements
		state.dialog = document.createElement('div');
		state.dialog.setAttribute('id', dialogname);
		$('body').append(state.dialog);

		state.infotext = document.createElement('div');
		state.infotext.setAttribute('id', infotextname);
		$('#' + dialogname).append(state.infotext);

		function ok() {
			state.dialog.dialog('close');
		}

		// Transform them into jquery-ui widgets
		state.dialog = $('#' + dialogname).dialog({
			dialogClass: 'no-close',
			autoOpen: false,
			closeOnEscape: false,
			resizable: false,
			draggable: false,
			modal: true,
			title: title,
			width: width,
			buttons: [{text: 'OK', click: ok}]
		});
		state.infotext = $('#' + infotextname);

		dialogstates.push(state);
		return state;
	}

	function wrapWithRuntimeCheck(thunk) {
		try {
			thunk();
		} catch (e) {
			// Hide all other dialogs before showing the runtime error one.
			for (var i = 0; i < dialogstates.length; i++)
				dialogstates[i].dialog.dialog('close');
			runtimeError(e.message);
		}
	}

	// i: Current iteration
	// n: Number of iterations to run in total.
	// k: continuation (resumes MH)
	var period = 10;
	var mhstate = null;
	function mhProgress(i, n, k) {
		if (mhstate === null)
			mhstate = createProgressDialog('mh', 'Generating with MH...');
		mhstate.dialog.dialog('open');
		if (i === 1)
			mhstate.cancelled = false;

		if (mhstate.cancelled) {
			mhstate.dialog.dialog('close');
			return;
		}

		if (i === n) {
			mhstate.dialog.dialog('close');
		} else {
			var percentage = i/n * 100;
			mhstate.infotext.text('Iteration ' + i + '/' + n);
			mhstate.progressbar.progressbar('value', percentage);
		}

		// Invoke continuation k once display has finished updating.
		// This will break the trampoline loop, so we have to restart it.
		if (i % period === 0) {
			window.setTimeout(function() {
				wrapWithRuntimeCheck(function() {
					trampoline = k();
					while(trampoline) trampoline = trampoline();
				});
			});
		} else {
			return k();
		}
	}

	// gen: generation (how many factors the filter has passed)
	// nFinished: number of particles finished
	// nTotal: number of particles total.
	// k: continuation (resumes SMC)
	var smcstate = null;
	function smcProgress(gen, nFinished, nTotal, k) {
		if (smcstate === null)
			smcstate = createProgressDialog('smc', 'Generating with SMC...', 500);
		smcstate.dialog.dialog('open');
		if (gen === 1)
			smcstate.cancelled = false;

		if (smcstate.cancelled) {
			smcstate.dialog.dialog('close');
			return;
		}

		if (nFinished === nTotal) {
			smcstate.dialog.dialog('close');
		} else {
			var percentage = nFinished/nTotal * 100;
			smcstate.infotext.text('Generation ' + gen + ' (' + nFinished + '/' + nTotal + ' particles finished)');
			smcstate.progressbar.progressbar('value', percentage);
		}

		// Invoke k once display is finished updating
		// (again, we need to restart the trampoline)
		window.setTimeout(function() {
			wrapWithRuntimeCheck(function() {
				trampoline = k();
				while(trampoline) trampoline = trampoline();
			});
		});
	}

	var compilestate = null;
	function compileProgress(status) {
		if (compilestate === null)
			compilestate = createProgressDialog('compile', 'Compiling...', 300, false);
		if (status === 'start') {
			compilestate.dialog.dialog('open');
			// compilestate.infotext.text('');
			compilestate.progressbar.progressbar('value', false);
		} else if (status === 'end') {
			compilestate.dialog.dialog('close');
		} else throw new Error('Unrecognized compile status ' + status);
	}

	var compileErrorState = null;
	function compileError(errortext) {
		if (compileErrorState === null)
			compileErrorState = createErrorDialog('compileError', 'Compiler Error!', 500);
		compileErrorState.infotext.text(errortext);
		compileErrorState.dialog.dialog('open');
	}

	var runtimeErrorState = null;
	function runtimeError(errortext) {
		if (runtimeErrorState === null)
			runtimeErrorState = createErrorDialog('runtimeError', 'Runtime Error!', 500);
		runtimeErrorState.infotext.text(errortext);
		runtimeErrorState.dialog.dialog('open');
	}

	return {
		MH: mhProgress,
		SMC: smcProgress,
		Compile: compileProgress,
		CompilerError: compileError,
		RuntimeError: runtimeError,
		wrapWithRuntimeCheck: wrapWithRuntimeCheck
	};

})();



