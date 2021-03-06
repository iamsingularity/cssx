// ********************************************************************
// Settings

var CODEMIRROR_SETTINGS = {
  value: '',
  mode:  'javascript',
  tabSize: 2,
  lineNumbers: true,
  autofocus: true,
  foldGutter: true,
  gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"]
};

// ********************************************************************
// Helpers

var lsGetItem = function (key) {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }
  return null;
};
var lsSetItem = function (key, value) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
  }
};

var toggling = function (container, label, callback, group) {
  var storageKey = 'cssx-' + label, oldValue;
  var is = lsGetItem(storageKey) === 'true';
  var updateUI = function () {
    container.innerHTML = (is ? '&#x2714;' : '&#x2718;') + ' ' + label;
  };

  container.addEventListener('click', function () {
    oldValue = is;
    if (group) toggling.disableAllExcept();
    lsSetItem(storageKey, is = !oldValue);
    updateUI();
    callback(is);
  });
  if (group) {
    toggling.toggles[storageKey] = function () {
      lsSetItem(storageKey, is = false);
      updateUI();
      callback(is);
    };
  }
  updateUI();
  if (is) {
    callback(is);
  }
};
toggling.toggles = {};
toggling.disableAllExcept = function (storageKey) {
  for (var key in toggling.toggles) {
    if (key !== storageKey) toggling.toggles[key]();
  }
};

var el = function (sel) { return document.querySelector(sel); };
var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
var saveCode = function (code) {
  lsSetItem('cssx-playground-code', code);
  return code;
};
var getCode = function () {
  return lsGetItem('cssx-playground-code') || DefaultStyles || '';
};

// ********************************************************************
// Renders

var renderEditor = function (onChange) {
  var container = el('.js-code-editor');
  var editor = CodeMirror(container, CODEMIRROR_SETTINGS);

  editor.on('change', function () {
    onChange(editor.getValue());
  });
  editor.setValue(getCode());

  container.addEventListener('click', function () {
    editor.focus();
  });
  return editor;
};
var renderOutput = function () {
  var settings = clone(CODEMIRROR_SETTINGS), output;

  settings.readOnly = true;
  settings.cursorBlinkRate = -1;
  output = CodeMirror(el('.js-output-editor'), settings);
  return output;
};
var renderMessage = function (message) {
  var container = el('.js-message');

  container.style.display = 'block';
  container.innerHTML = message;
};
var renderOutMessage = function () {
  var container = el('.js-message');

  container.style.display = 'none';
  container.innerHTML = '';
};
var renderError = function (message) {
  el('.js-output-editor').setAttribute('data-status', 'error');
  renderMessage(message);
};
var renderOutError = function () {
  el('.js-output-editor').setAttribute('data-status', '');
  renderOutMessage();
};

// ********************************************************************
// Boot

var init = function () {
  var ast, transpiled, output, editor;
  var transpilerOpts = { minified: false };

  // cssx gobal settings
  cssx.domChanges(false);
  cssx.minify(false);

  // printing
  var printIfValid = function (value, fallback) { output.setValue(!!value ? value : fallback || ''); };
  var printText = function (text) { printIfValid(text); };
  var printJS = function () { printText(transpiled); };
  var printAST = function () { printIfValid(JSON.stringify(ast, null, 2)); };
  var printCompiledCSS = function () {
    var func, generatedCSS, css;

    cssx.clear();
    try {
      func = new Function(transpiled);
      renderOutError();
    } catch (err) {
      renderError('Error while using the transpiled code:<br />' + err.message);
      return false;
    }

    try {
      func();
      renderOutError();
    } catch(err) {
      renderError('Error while running the transpiled code:<br />' + err.message);
      return false;
    }

    try {
      generatedCSS = cssx.getStylesheets().map(function (stylesheet) {
        return stylesheet.compileImmediate().getCSS();
      });
      css = generatedCSS.join('');
      renderOutError();
    } catch(err) {
      renderError('Error while fetching the generated CSS:<br />' + err.message);
      return false;
    }
    printIfValid(css, 'The generated JavaScript do not produce any CSS.');
    return true;
  };
  var print = printCompiledCSS;

  output = renderOutput();
  editor = renderEditor(updateOutput);

  // render in the right part of the screen
  function updateOutput(value) {
    CSSXTranspiler.reset();
    try {
      ast = CSSXTranspiler.ast(value);
    } catch(err) {
      renderOutError();
      renderError('Error while generating the AST:<br />' + err.message);
      return false;
    }

    try {
      transpiled = CSSXTranspiler(value, transpilerOpts);
      renderOutError();
      if (print()) {
        saveCode(value);
      }
    } catch(err) {
      // console.log(err);
      renderError('Error while transpiling:<br />' + err.message);
      return false;
    }
  };

  // toggles
  toggling(el('.js-view-ast'), 'View AST', function (value) {
    print = value ? printAST : printCompiledCSS;
    print();
  }, true);
  toggling(el('.js-view-js'), 'View JS', function (value) {
    print = value ? printJS : printCompiledCSS;
    print();
  }, true);
  toggling(el('.js-minify'), 'Minify', function (value) {
    transpilerOpts.minified = value;
    cssx.minify(value);
    updateOutput(editor.getValue());
  }, false);
};

window.onload = init;