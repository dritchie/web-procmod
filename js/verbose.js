var Verbose = (function() {

	var state = null;

	function createDialog() {
		state = {};

		// Create HTML elements
		state.dialog = document.createElement('div');
		state.dialog.setAttribute('id', 'dialog');
		$('body').append(state.dialog);

		state.infotext = document.createElement('div');
		state.infotext.setAttribute('id', 'infotext');
		$('#dialog').append(state.infotext);

		state.progressbar = document.createElement('div');
		state.progressbar.setAttribute('id', 'progressbar');
		$('#dialog').append(state.progressbar);

		// Transform them into jquery-ui widgets
		state.dialog = $('#dialog').dialog({
			autoOpen: false,
			closeOnEscape: false,
			resizable: false,
			draggable: false,
			modal: true,
			title: 'Generating...',
			buttons: [{text: 'Cancel', click: cancel}]
		});
		state.infotext = $('#infotext');
		state.progressbar = $('#progressbar').progressbar({});

		function cancel() {
			state.cancelled = true;
		}
	}

	// i: Current iteration
	// n: Number of iterations to run in total.
	// k: continuation (resumes MH)
	var period = 10;
	function verboseMH(i, n, k) {
		if (state === null)
			createDialog();
		state.dialog.dialog('option', 'width', 300);
		state.dialog.dialog('open');
		if (i === 1)
			state.cancelled = false;

		if (state.cancelled) {
			state.dialog.dialog('close');
			return;
		}

		if (i === n) {
			state.dialog.dialog('close');
		} else {
			var percentage = i/n * 100;
			state.infotext.text('Iteration ' + i + '/' + n);
			state.progressbar.progressbar('value', percentage);
		}

		// Invoke continuation k once display has finished updating.
		// This will break the trampoline loop, so we have to restart it.
		if (i % period === 0) {
			window.setTimeout(function() {
				trampoline = k();
				while(trampoline) trampoline = trampoline();
			});
		} else {
			return k();
		}
	}

	// gen: generation (how many factors the filter has passed)
	// nFinished: number of particles finished
	// nTotal: number of particles total.
	// k: continuation (resumes SMC)
	function verboseSMC(gen, nFinished, nTotal, k) {
		if (state === null)
			createDialog();
		state.dialog.dialog('option', 'width', 500);
		state.dialog.dialog('open');
		if (gen === 1)
			state.cancelled = false;

		if (state.cancelled) {
			state.dialog.dialog('close');
			return;
		}

		if (nFinished === nTotal) {
			state.dialog.dialog('close');
		} else {
			var percentage = nFinished/nTotal * 100;
			state.infotext.text('Generation ' + gen + ' (' + nFinished + '/' + nTotal + ' particles finished)');
			state.progressbar.progressbar('value', percentage);
		}

		// Invoke k once display is finished updating
		// (again, we need to restart the trampoline)
		window.setTimeout(function() {
			trampoline = k();
			while(trampoline) trampoline = trampoline();
		});
	}

	return {
		MH: verboseMH,
		SMC: verboseSMC
	};

})();



