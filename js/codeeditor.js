var CodeEditor = (function() {

	function create() {
		var outerdiv = $('<div></div>', {id: 'codeDialog'});
		$('body').append(outerdiv);
		var textarea = $('<textarea></textarea>', {id: 'codeTextArea'});
		textarea.text('// This is a comment!');
		outerdiv.append(textarea);

		var defaultWidth = 850;
		var defaultHeight = 850;

		var state = {};

		state.dialog = outerdiv.dialog({
			title: 'Code Editor',
			autoOpen: true,
			closeOnEscape: false,
			draggable: false,
			resizable: true,
			position: {my: 'left top', at: 'left top', of: window},
			show: {effect: 'slide', duration: 100},
			hide: {effect: 'slide', duration: 100},
			width: defaultWidth,
			height: defaultHeight
		});
		state.dialog.parents(".ui-dialog").css("opacity", "0.85");

		state.editor = CodeMirror.fromTextArea(document.getElementById('codeTextArea'), {
			// lineNumbers: true,
			matchBrackets: true,
			autoCloseBrackets: true,
			viewportMargin: Infinity,
			lineWrapping: true
		});
		// // Stop keyboard events from propagating out of the editor
		// state.editor.getWrapperElement().onkeypress = function(e) {
		// 	e.stopImmediatePropagation();
		// }

		state.visible = true;
		state.open = function() { state.dialog.dialog('open'); state.visible = true; }
		state.close = function() { state.dialog.dialog('close'); state.visible = false; }
		state.setEventHandler = function(name, fn) {
			state.dialog.on(name, fn);
		}

		state.loadCodeFromFile = function(filename, cb) {
			// Load WebPPL procedural modeling code
			$.get(filename, function (code)
			{
				state.editor.setValue(code);
				var lc = state.editor.lineCount();
				state.editor.scrollIntoView(lc-1, 0);
				if (cb) cb();
			});	
		}

		// Returns the compiled program if the code has changed since last compile.
		// Otherwise, returns false.
		state.compile = function() {
			var currCode = state.editor.getValue();
			if (state.prevCode !== currCode) {
				state.prevCode = currCode;
				var compiledCode = webppl.compile("(function(){" + currCode + "})()", true, true);
				// console.log(compiledCode);
				compiledProgram = eval(compiledCode);
				return compiledProgram;
			} else return false;
		}


		return state;
	}

	return {
		create: create
	};

})();