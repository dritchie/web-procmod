var Verbose = (function() {

	var mh = null;

	function createDialogMH() {
		mh = {};

		// Create HTML elements
		mh.dialog = document.createElement('div');
		mh.dialog.setAttribute('id', 'dialog');
		$('body').append(mh.dialog);

		mh.infotext = document.createElement('div');
		mh.infotext.setAttribute('id', 'infotext');
		$('#dialog').append(mh.infotext);

		mh.progressbar = document.createElement('div');
		mh.progressbar.setAttribute('id', 'progressbar');
		$('#dialog').append(mh.progressbar);

		// Transform them into jquery-ui widgets
		mh.dialog = $('#dialog').dialog({
			autoOpen: false,
			closeOnEscape: false,
			resizable: false,
			draggable: false,
			modal: true,
			title: 'Generating...',
			buttons: [{text: 'Cancel', click: cancel}]
		});
		mh.infotext = $('#infotext');
		mh.progressbar = $('#progressbar').progressbar({});

		function cancel() {
			mh.cancelled = true;
		}
	}

	// i: Current iteration
	// n: Number of iterations to run in total.
	// k: continuation (resumes MH)
	function verboseMH(i, n, k) {
		if (mh === null)
			createDialogMH();
		mh.dialog.dialog('open');
		if (i === 1)
			mh.cancelled = false;

		if (mh.cancelled) {
			mh.dialog.dialog('close');
			return;
		}

		if (i === n) {
			mh.dialog.dialog('close');
		} else {
			var percentage = i/n * 100;
			mh.infotext.text('Iteration ' + i + '/' + n);
			mh.progressbar.progressbar('value', percentage);
		}

		// Invoke continuation k once display has finished updating.
		// This will break the trampoline loop, so we have to restart it.
		window.setTimeout(function() {
			trampoline = k();
			while(trampoline) trampoline = trampoline();
		});
	}

	return {
		MH: verboseMH
	};

})();