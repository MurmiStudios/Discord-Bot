(function () {
  'use strict';
  document.querySelectorAll('.button-row').forEach(function (row) {
    var styleSelect = row.querySelector('.btn-style');
    var actionSelect = row.querySelector('.btn-action');
    var fieldBlocks = row.querySelectorAll('.action-fields');

    function update() {
      var isLink = styleSelect.value === 'link';
      var action = actionSelect.value;
      if (actionSelect.closest('.row')) actionSelect.closest('.row').hidden = isLink;

      fieldBlocks.forEach(function (block) {
        var forList = block.getAttribute('data-for').split(',');
        if (isLink) {
          block.hidden = forList.indexOf('link') === -1;
        } else {
          block.hidden = forList.indexOf('link') !== -1 || forList.indexOf(action) === -1;
        }
      });
    }

    styleSelect.addEventListener('change', update);
    actionSelect.addEventListener('change', update);
    update();
  });
})();
