(function () {
  'use strict';
  var openBtn = document.getElementById('drawer-open');
  var closeBtn = document.getElementById('drawer-close');
  var overlay = document.getElementById('drawer-overlay');
  if (!openBtn || !overlay) return;

  function open() {
    overlay.hidden = false;
  }
  function close() {
    overlay.hidden = true;
  }

  openBtn.addEventListener('click', open);
  if (closeBtn) closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !overlay.hidden) close();
  });
})();
