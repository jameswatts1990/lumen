(function initMsgReaderBootstrap(global) {
  if (!global) return;

  var state = {
    source: 'none',
    available: false,
    attemptedSources: [],
    errors: []
  };

  function setReady(sourceLabel) {
    state.source = sourceLabel;
    state.available = typeof global.MSGReader === 'function';
    return state.available;
  }

  function loadScript(src, label) {
    return new Promise(function(resolve, reject) {
      state.attemptedSources.push(label);
      var script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = function() {
        if (typeof global.MSGReader === 'function') {
          resolve(label);
        } else {
          var err = new Error('Loaded script but MSGReader was not initialized');
          state.errors.push(label + ': ' + err.message);
          reject(err);
        }
      };
      script.onerror = function() {
        var err = new Error('Failed to load script');
        state.errors.push(label + ': ' + err.message);
        reject(err);
      };
      document.head.appendChild(script);
    });
  }

  global.__msgReaderRuntime = state;
  global.__msgReaderReadyPromise = Promise.resolve()
    .then(function() {
      if (typeof global.MSGReader === 'function') return 'preloaded';
      return loadScript('./assets/vendor/msg.reader.local.min.js', 'local-bundle');
    })
    .catch(function() {
      if (typeof global.MSGReader === 'function') return 'global-existing';
      return loadScript('https://cdn.jsdelivr.net/npm/@kenjiuno/msgreader@1.24.0/msg.reader.min.js', 'cdn-jsdelivr');
    })
    .catch(function() {
      if (typeof global.MSGReader === 'function') return 'global-existing';
      return loadScript('https://unpkg.com/@kenjiuno/msgreader@1.24.0/msg.reader.min.js', 'cdn-unpkg');
    })
    .then(function(sourceLabel) {
      setReady(sourceLabel);
      return state;
    })
    .catch(function() {
      setReady('none');
      return state;
    });
})(window);
