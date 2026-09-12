(function () {
  'use strict';
  var field = document.getElementById('recipient-field');
  if (!field) return;

  var chipsWrap = document.getElementById('recipient-chips');
  var searchInput = document.getElementById('recipient-search');
  var countLabel = document.getElementById('recipient-count');
  var maxRecipients = Number(field.getAttribute('data-max') || 200);
  var combo = null;
  var comboItems = [];
  var comboActive = -1;
  var searchTimer = null;
  var csrfToken = document.querySelector('meta[name="csrf-token"]');

  function currentIds() {
    return Array.from(chipsWrap.querySelectorAll('input[name="recipientIds"]')).map(function (i) {
      return i.value;
    });
  }

  function updateCount() {
    if (countLabel) countLabel.textContent = String(currentIds().length);
  }

  function addChip(id, label) {
    if (currentIds().indexOf(id) !== -1) return;
    if (currentIds().length >= maxRecipients) return;
    var chip = document.createElement('span');
    chip.className = 'chip';
    chip.setAttribute('data-id', id);
    chip.textContent = label + ' ';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Entfernen');
    btn.textContent = '×';
    btn.addEventListener('click', function () {
      chip.remove();
      updateCount();
    });
    chip.appendChild(btn);
    var hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.name = 'recipientIds';
    hidden.value = id;
    chipsWrap.insertBefore(chip, searchInput);
    chipsWrap.insertBefore(hidden, searchInput);
    updateCount();
  }

  function closeCombo() {
    if (combo) combo.remove();
    combo = null;
    comboItems = [];
    comboActive = -1;
  }

  function renderCombo(items) {
    closeCombo();
    comboItems = items;
    combo = document.createElement('div');
    combo.className = 'combo-list';
    if (!items.length) {
      var empty = document.createElement('div');
      empty.className = 'combo-empty';
      empty.textContent = 'Keine Treffer.';
      combo.appendChild(empty);
    } else {
      items.forEach(function (item, i) {
        var row = document.createElement('div');
        row.className = 'combo-item';
        row.setAttribute('data-active', i === 0 ? 'true' : 'false');
        row.innerHTML = '';
        var label = document.createElement('span');
        label.textContent = item.label;
        row.appendChild(label);
        var sub = document.createElement('span');
        sub.className = 'type';
        sub.textContent = item.type === 'role' ? 'Rolle · ' + item.sublabel : item.sublabel;
        row.appendChild(sub);
        row.addEventListener('click', function () {
          selectItem(item);
        });
        combo.appendChild(row);
      });
      comboActive = 0;
    }
    field.appendChild(combo);
  }

  function selectItem(item) {
    if (item.type === 'role') {
      fetch('/api/role-members/' + item.id)
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          (data.results || []).forEach(function (m) {
            addChip(m.id, m.label);
          });
        });
    } else {
      addChip(item.id, item.label);
    }
    searchInput.value = '';
    closeCombo();
    searchInput.focus();
  }

  searchInput.addEventListener('input', function () {
    clearTimeout(searchTimer);
    var q = searchInput.value.trim();
    if (!q) {
      closeCombo();
      return;
    }
    searchTimer = setTimeout(function () {
      fetch('/api/search?q=' + encodeURIComponent(q))
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          renderCombo(data.results || []);
        });
    }, 250);
  });

  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Backspace' && !searchInput.value) {
      var chips = chipsWrap.querySelectorAll('.chip');
      if (chips.length) {
        chips[chips.length - 1].remove();
        updateCount();
      }
    } else if (e.key === 'ArrowDown' && combo) {
      e.preventDefault();
      comboActive = Math.min(comboActive + 1, comboItems.length - 1);
      markActive();
    } else if (e.key === 'ArrowUp' && combo) {
      e.preventDefault();
      comboActive = Math.max(comboActive - 1, 0);
      markActive();
    } else if (e.key === 'Enter' && combo && comboItems[comboActive]) {
      e.preventDefault();
      selectItem(comboItems[comboActive]);
    } else if (e.key === 'Escape') {
      closeCombo();
    }
  });
  function markActive() {
    var rows = combo.querySelectorAll('.combo-item');
    rows.forEach(function (r, i) {
      r.setAttribute('data-active', i === comboActive ? 'true' : 'false');
    });
  }
  document.addEventListener('click', function (e) {
    if (combo && !field.contains(e.target)) closeCombo();
  });

  // ---- Massenversand mit Live-Fortschritt statt vollem Seiten-Neuladen ----
  var form = document.getElementById('composer-form');
  // Der Senden-Button sitzt oben in der Kopfzeile, nicht im Formular selbst
  // -- verbunden nur ueber das form="composer-form"-Attribut. form.querySelector
  // faende ihn nicht, weil er kein Nachfahre des <form>-Elements ist.
  var sendBtn = document.querySelector('button[form="composer-form"][value="send"]');
  if (!sendBtn) return;

  var progressBox = null;
  function showProgress(state) {
    if (!progressBox) {
      progressBox = document.createElement('div');
      progressBox.className = 'notice notice-info';
      document.querySelector('.page-header').insertAdjacentElement('afterend', progressBox);
    }
    if (state.done) {
      progressBox.className = 'notice ' + (state.failed ? 'notice-warning' : 'notice-success');
      progressBox.textContent = state.sent + ' zugestellt, ' + state.failed + ' fehlgeschlagen.';
    } else {
      progressBox.textContent = 'Sende … ' + (state.index || 0) + ' / ' + state.total;
    }
  }

  form.addEventListener('submit', function (e) {
    if (e.submitter !== sendBtn) return;
    if (form.getAttribute('data-context-label') !== 'Direktnachricht') return;
    var ids = currentIds();
    if (!ids.length) return;

    e.preventDefault();
    sendBtn.disabled = true;
    var payload = window.PanelComposer.collectPayload();
    fetch('/api/send-dm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken ? csrfToken.content : '' },
      body: JSON.stringify({
        recipientIds: ids,
        message: payload,
        actorId: form.getAttribute('data-actor-id'),
        actorTag: form.getAttribute('data-actor-tag'),
        logSummary: 'Nachricht',
      }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (!data.jobId) {
          sendBtn.disabled = false;
          return;
        }
        var es = new EventSource('/api/send-dm/' + data.jobId + '/stream');
        es.onmessage = function (ev) {
          var state = JSON.parse(ev.data);
          showProgress(state);
          if (state.done) {
            es.close();
            sendBtn.disabled = false;
          }
        };
        es.onerror = function () {
          es.close();
          sendBtn.disabled = false;
        };
      })
      .catch(function () {
        sendBtn.disabled = false;
      });
  });
})();
