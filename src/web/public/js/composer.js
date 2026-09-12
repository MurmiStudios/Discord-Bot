(function () {
  'use strict';

  var form = document.getElementById('composer-form');
  if (!form) return;

  // ---- Platzhalter an der Schreibmarke einfuegen ----
  document.querySelectorAll('.chip-btn[data-insert-into]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = document.getElementById(btn.getAttribute('data-insert-into'));
      if (!target) return;
      var text = btn.getAttribute('data-insert-text');
      var start = target.selectionStart == null ? target.value.length : target.selectionStart;
      var end = target.selectionEnd == null ? target.value.length : target.selectionEnd;
      target.value = target.value.slice(0, start) + text + target.value.slice(end);
      target.focus();
      target.selectionStart = target.selectionEnd = start + text.length;
      target.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  // ---- Zeichenzaehler Text ----
  var contentField = document.getElementById('c-content');
  var contentCount = document.getElementById('c-content-count');
  if (contentField && contentCount) {
    contentField.addEventListener('input', function () {
      contentCount.textContent = contentField.value.length + ' / 2000';
    });
  }

  // ---- Embed ein-/ausblenden ----
  var embedToggle = document.getElementById('c-embed-enabled');
  var embedBody = document.getElementById('c-embed-body');
  if (embedToggle && embedBody) {
    embedToggle.addEventListener('change', function () {
      embedBody.hidden = !embedToggle.checked;
      schedulePreview();
    });
  }

  // ---- Vorschau-Modus (Beispieldaten / Rohtext) ----
  var modeWrap = document.getElementById('c-preview-mode');
  var previewMode = 'sample';
  if (modeWrap) {
    modeWrap.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        modeWrap.querySelectorAll('.tab').forEach(function (t) {
          t.classList.remove('active');
        });
        tab.classList.add('active');
        previewMode = tab.getAttribute('data-mode');
        schedulePreview();
      });
    });
  }

  // ---- Live-Vorschau (Server-gerendert, per Fetch nachgeladen) ----
  var previewBox = document.getElementById('c-preview');
  var csrfToken = document.querySelector('meta[name="csrf-token"]');
  var timer = null;

  function collectPayload() {
    var fields = [];
    form.querySelectorAll('[name^="embed[fields]["]').forEach(function (el) {
      var m = el.name.match(/embed\[fields\]\[(\d+)\]\[(name|value|inline)\]/);
      if (!m) return;
      var idx = Number(m[1]);
      fields[idx] = fields[idx] || {};
      fields[idx][m[2]] = el.type === 'checkbox' ? el.checked : el.value;
    });

    return {
      content: contentField ? contentField.value : '',
      embedEnabled: embedToggle ? embedToggle.checked : false,
      embed: {
        title: valueOf('c-embed-title'),
        description: valueOf('c-embed-desc'),
        color: valueOf('c-embed-color'),
        footer: valueOf('c-embed-footer'),
        fields: fields.filter(Boolean).filter(function (f) {
          return f.name && f.value;
        }),
      },
      imageTemplateId: valueOf('c-image-template'),
      actionBarId: valueOf('c-action-bar'),
      roleName: form.getAttribute('data-role-name') || '',
      contextLabel: form.getAttribute('data-context-label') || 'Vorschau',
      mode: previewMode,
    };
  }

  function valueOf(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  function schedulePreview() {
    if (!previewBox) return;
    clearTimeout(timer);
    timer = setTimeout(runPreview, 350);
  }

  function runPreview() {
    fetch('/api/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken ? csrfToken.content : '',
      },
      body: JSON.stringify(collectPayload()),
    })
      .then(function (r) {
        return r.ok ? r.text() : null;
      })
      .then(function (html) {
        if (html != null) previewBox.innerHTML = html;
      })
      .catch(function () {});
  }

  form.addEventListener('input', schedulePreview);
  form.addEventListener('change', schedulePreview);

  window.PanelComposer = { collectPayload: collectPayload };
})();
