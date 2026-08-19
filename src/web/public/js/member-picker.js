/** Mitgliederauswahl auf der DM-Seite. */
import { csrfToken } from './common.js';

const suche = document.getElementById('mitglied-suche');
const liste = document.getElementById('mitglied-liste');
const gewaehlteBox = document.getElementById('gewaehlte');
const anzahlEl = document.getElementById('anzahl');
const absenden = document.getElementById('absenden');
const formular = document.getElementById('dm-formular');
const rollenAuswahl = document.getElementById('rollen-auswahl');
const rolleUebernehmen = document.getElementById('rolle-uebernehmen');

if (formular) {
  /** id → Anzeigename */
  const gewaehlt = new Map();

  function zeichneGewaehlte() {
    gewaehlteBox.replaceChildren(
      ...[...gewaehlt].map(([id, name]) => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.append(name);

        const weg = document.createElement('button');
        weg.type = 'button';
        weg.textContent = '×';
        weg.setAttribute('aria-label', `${name} entfernen`);
        weg.addEventListener('click', () => {
          gewaehlt.delete(id);
          zeichneGewaehlte();
        });

        chip.append(weg);
        return chip;
      }),
    );
    anzahlEl.textContent = String(gewaehlt.size);
    absenden.disabled = gewaehlt.size === 0;

    // Versteckte Felder für den Formularversand neu aufbauen.
    formular.querySelectorAll('input[name="empfaenger"]').forEach((el) => el.remove());
    for (const id of gewaehlt.keys()) {
      const feld = document.createElement('input');
      feld.type = 'hidden';
      feld.name = 'empfaenger';
      feld.value = id;
      formular.append(feld);
    }
  }

  function zeileVerknuepfen(el) {
    el.addEventListener('click', () => {
      gewaehlt.set(el.dataset.id, el.dataset.name);
      zeichneGewaehlte();
    });
  }

  liste.querySelectorAll('.auswahl-zeile').forEach(zeileVerknuepfen);

  /** Serverseitig suchen — der Cache im Bot ist die Wahrheitsquelle. */
  let timer;
  suche?.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const res = await fetch(`/api/mitglieder?q=${encodeURIComponent(suche.value)}`);
      if (!res.ok) return;
      const treffer = await res.json();

      liste.replaceChildren(
        ...treffer.map((m) => {
          const zeile = document.createElement('div');
          zeile.className = 'auswahl-zeile';
          zeile.dataset.id = m.id;
          zeile.dataset.name = m.displayName;

          const bild = document.createElement('img');
          bild.src = m.avatarUrl;
          bild.width = 24;
          bild.height = 24;
          bild.alt = '';

          const name = document.createElement('span');
          name.textContent = m.displayName;

          const tag = document.createElement('span');
          tag.className = 'tag';
          tag.textContent = `@${m.username}`;

          zeile.append(bild, name, tag);
          zeileVerknuepfen(zeile);
          return zeile;
        }),
      );
    }, 250);
  });

  rolleUebernehmen?.addEventListener('click', async () => {
    const roleId = rollenAuswahl.value;
    if (!roleId) return;
    const res = await fetch(`/api/rolle/${roleId}/mitglieder`, {
      headers: { 'x-csrf-token': csrfToken() },
    });
    if (!res.ok) return;
    for (const m of await res.json()) gewaehlt.set(m.id, m.displayName);
    zeichneGewaehlte();
  });

  zeichneGewaehlte();
}
