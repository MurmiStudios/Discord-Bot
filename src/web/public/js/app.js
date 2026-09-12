(function () {
  'use strict';

  // ---- Seitensuche: Taste "/" oder Klick auf die Lupe ----
  var overlay = document.getElementById('search-overlay');
  var input = document.getElementById('search-input');
  var results = document.getElementById('search-results');
  var openBtn = document.getElementById('search-open');
  var indexEl = document.getElementById('page-index');
  var pages = [];
  try {
    pages = indexEl ? JSON.parse(indexEl.textContent) : [];
  } catch (e) {
    pages = [];
  }
  var activeIndex = -1;

  function renderResults(items) {
    results.innerHTML = '';
    activeIndex = items.length ? 0 : -1;
    if (!items.length) {
      var empty = document.createElement('div');
      empty.className = 'combo-empty';
      empty.textContent = 'Keine Seite gefunden.';
      results.appendChild(empty);
      return;
    }
    items.forEach(function (item, i) {
      var a = document.createElement('a');
      a.href = item.href;
      a.textContent = item.label;
      if (i === 0) a.setAttribute('data-active', 'true');
      results.appendChild(a);
    });
  }

  function filterPages(q) {
    var query = q.trim().toLowerCase();
    if (!query) return pages;
    return pages.filter(function (p) {
      return p.label.toLowerCase().indexOf(query) !== -1;
    });
  }

  function openSearch() {
    if (!overlay) return;
    overlay.hidden = false;
    input.value = '';
    renderResults(pages);
    setTimeout(function () {
      input.focus();
    }, 0);
  }

  function closeSearch() {
    if (!overlay) return;
    overlay.hidden = true;
  }

  if (openBtn) openBtn.addEventListener('click', openSearch);
  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeSearch();
    });
  }
  if (input) {
    input.addEventListener('input', function () {
      renderResults(filterPages(input.value));
    });
    input.addEventListener('keydown', function (e) {
      var links = results.querySelectorAll('a');
      if (e.key === 'Escape') {
        closeSearch();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, links.length - 1);
        updateActive(links);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        updateActive(links);
      } else if (e.key === 'Enter') {
        if (links[activeIndex]) {
          e.preventDefault();
          window.location.href = links[activeIndex].getAttribute('href');
        }
      }
    });
  }
  function updateActive(links) {
    links.forEach(function (a, i) {
      if (i === activeIndex) a.setAttribute('data-active', 'true');
      else a.removeAttribute('data-active');
    });
    if (links[activeIndex]) links[activeIndex].scrollIntoView({ block: 'nearest' });
  }

  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    var typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
    if (e.key === '/' && !typing) {
      e.preventDefault();
      openSearch();
    } else if (e.key === 'Escape' && overlay && !overlay.hidden) {
      closeSearch();
    }
  });

  // ---- Bestaetigung vor loeschenden Aktionen ----
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.confirm(form.getAttribute('data-confirm'))) {
        e.preventDefault();
      }
    });
  });

  // ---- Ladeanzeige beim Absenden (verhindert Doppelklick) ----
  document.querySelectorAll('form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      // e.submitter ist der tatsaechlich geklickte Button -- auch wenn er,
      // wie der Senden-Button in der Kopfzeile, ueber form="..." statt als
      // Nachfahre mit dem Formular verbunden ist.
      var btn = e.submitter || form.querySelector('button[type="submit"]');
      if (btn && !btn.disabled) {
        btn.disabled = true;
        btn.dataset.originalText = btn.textContent;
        btn.textContent = 'Einen Moment …';
        setTimeout(function () {
          btn.disabled = false;
          if (btn.dataset.originalText) btn.textContent = btn.dataset.originalText;
        }, 8000);
      }
    });
  });
})();
