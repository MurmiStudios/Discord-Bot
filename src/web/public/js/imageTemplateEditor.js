(function () {
  'use strict';
  var form = document.getElementById('tpl-form');
  if (!form) return;
  var csrfToken = document.querySelector('meta[name="csrf-token"]');
  var img = document.getElementById('tpl-preview-img');
  var timer = null;

  function val(name) {
    var el = form.elements[name];
    return el ? el.value : '';
  }
  function checked(name) {
    var el = form.elements[name];
    return el ? el.checked : false;
  }

  function collect() {
    var lines = [];
    for (var i = 0; i < 4; i++) {
      var text = val('lines[' + i + '][text]');
      if (!text) continue;
      lines.push({
        text: text,
        size: Number(val('lines[' + i + '][size]')) || 32,
        color: val('lines[' + i + '][color]') || '#ffffff',
        align: val('lines[' + i + '][align]') || 'left',
        shadow: checked('lines[' + i + '][shadow]'),
        x: val('lines[' + i + '][x]') === '' ? null : Number(val('lines[' + i + '][x]')),
        y: val('lines[' + i + '][y]') === '' ? null : Number(val('lines[' + i + '][y]')),
        maxWidth: Number(val('lines[' + i + '][maxWidth]')) || undefined,
      });
    }
    return {
      width: Number(val('width')) || 1200,
      height: Number(val('height')) || 500,
      bg_type: document.getElementById('bg-type').value,
      bg_color: val('bgColor'),
      bg_image_path: document.getElementById('bg-image-path').value || null,
      bg_dim: Number(val('bgDim')) || 0,
      avatar_json: {
        enabled: checked('avatarEnabled'),
        shape: val('avatarShape') || 'round',
        x: Number(val('avatarX')) || 80,
        y: Number(val('avatarY')) || 80,
        size: Number(val('avatarSize')) || 90,
        border: Number(val('avatarBorder')) || 0,
      },
      lines_json: lines,
      align: 'left',
    };
  }

  function refresh() {
    if (!img) return;
    fetch('/api/preview-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken ? csrfToken.content : '' },
      body: JSON.stringify(collect()),
    })
      .then(function (r) {
        return r.ok ? r.blob() : null;
      })
      .then(function (blob) {
        if (blob) img.src = URL.createObjectURL(blob);
      })
      .catch(function () {});
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(refresh, 400);
  }

  form.addEventListener('input', schedule);
  form.addEventListener('change', schedule);

  var upload = document.getElementById('bg-upload');
  if (upload) {
    upload.addEventListener('change', function () {
      var file = upload.files[0];
      if (!file) return;
      var fd = new FormData();
      fd.append('file', file);
      fetch('/api/upload', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken ? csrfToken.content : '' }, body: fd })
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          if (data.path) {
            document.getElementById('bg-image-path').value = data.path;
            document.getElementById('bg-type').value = 'image';
            refresh();
          }
        });
    });
  }

  // ---- Vorschau mit echten Mitgliedern ----
  var memberSearch = document.getElementById('member-preview-search');
  if (memberSearch && img) {
    var templateId = form.querySelector('input[name="templateId"]');
    memberSearch.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      fetch('/api/search?q=' + encodeURIComponent(memberSearch.value))
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          var member = (data.results || []).find(function (r) {
            return r.type === 'member';
          });
          if (member && templateId) {
            img.src = '/vorlagen/' + templateId.value + '/vorschau-mitglied?userId=' + member.id;
          }
        });
    });
  }
})();
