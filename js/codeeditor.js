var CodeEditor = (function() {

	function create() {
		var outerdiv = $('<div></div>', {id: 'codeDialog'});
		$('body').append(outerdiv);
		var textarea = $('<textarea></textarea>', {id: 'codeTextArea'});
		textarea.text('// Loading source code...');
		outerdiv.append(textarea);

		var defaultWidth = 870;
		var defaultHeight = 850;

		var state = {};

		state.dialog = outerdiv.dialog({
			title: 'Code Editor',
			autoOpen: true,
			closeOnEscape: false,
			draggable: false,
			resizable: true,
			position: {my: 'left top', at: 'left top', of: window},
			// show: {effect: 'slide', duration: 100},
			// hide: {effect: 'slide', duration: 100},
			width: defaultWidth,
			height: defaultHeight
		});
		state.dialog.parents(".ui-dialog").css("opacity", "0.85");

		state.editor = CodeMirror.fromTextArea(document.getElementById('codeTextArea'), {
			lineNumbers: true,
			matchBrackets: true,
			autoCloseBrackets: true,
			viewportMargin: Infinity,
			lineWrapping: true
		});

		state.visible = true;
		state.open = function() {
			state.dialog.dialog('open');
		};
		state.close = function() {
			state.dialog.dialog('close');
		}
		state.dialog.on('dialogbeforeclose', function() {
			state.visible = false;
			// // Remember where we were last scrolled to
			// state.lastScrollState = state.editor.getScrollInfo();
		});
		state.dialog.on('dialogopen', function() {
			state.visible = true;
			// // Restore where we were last scrolled to
			// if (state.lastScrollState) {
			// 	state.editor.scrollTo(0, state.lastScrollState.top);
			// }
		});
		state.setEventHandler = function(name, fn) {
			state.dialog.on(name, fn);
		};

		state.loadCodeFromFile = function(filename, cb) {
			// Load WebPPL procedural modeling code
			$.get(filename, function (code)
			{
				state.editor.setValue(code);
				var lc = state.editor.lineCount();
				state.editor.scrollIntoView(lc-1);
				if (cb) cb();
			});	
		};

		// Takes callback with what to do when the compilation is done
		// Arg to callback is either the newly-compiled function, if the code
		//    has changed, or 'unchanged' if the code has not changed, or 'error'
		//    if there was a compiler error.
		state.compile = function(cb) {
			var currCode = state.editor.getValue();
			if (state.prevCode !== currCode) {
				state.prevCode = currCode;
				Verbose.Compile('start');
				window.setTimeout(function() {
					var compiledProgram;
					var succ = Verbose.wrapWithErrorCheck(function() {
						var compiledCode = webppl.compile("(function(){" + currCode + "})()", true, true);
						compiledProgram = eval(compiledCode);
						Verbose.Compile('end');
					}, Verbose.CompilerError);
					if (succ)
						cb(compiledProgram);
					else
						cb('error');
				}, 10);
			} else cb('unchanged');
		}


		return state;
	}

	return {
		create: create
	};

})();