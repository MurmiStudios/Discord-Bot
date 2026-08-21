/**
 * Editor für die Aktionen eines Buttons.
 *
 * Die Aktionsliste ist eine geordnete Folge unterschiedlich geformter Einträge —
 * so etwas lässt sich über gewöhnliche Formularfelder nicht sauber übertragen.
 * Sie wird deshalb hier im Browser gepflegt und beim Absenden als JSON in ein
 * verstecktes Feld geschrieben.
 *
 * Alles wird über Ereignis-Listener verknüpft und über die DOM-API erzeugt:
 * Die Content-Security-Policy verbietet Inline-Skripte und Inline-Styles.
 */
const daten = JSON.parse(document.getElementById('editor-daten').textContent);

const formular = document.getElementById('button-formular');
const aktionsliste = document.getElementById('aktionsliste');
const aktionenFeld = document.getElementById('aktionen-feld');
const formularTitel = document.getElementById('formular-titel');
const absendenKnopf = document.getElementById('f-absenden');
const abbrechenKnopf = document.getElementById('f-abbrechen');

/** Aktueller Stand der Aktionen; die Anzeige wird daraus neu aufgebaut. */
let aktionen = [];

/* ── kleine Bausteine ─────────────────────────────────────────────────── */

function el(tag, klasse, text) {
  const n = document.createElement(tag);
  if (klasse) n.className = klasse;
  if (text !== undefined) n.textContent = text;
  return n;
}

function feld(beschriftung, eingabe) {
  const label = el('label');
  label.append(el('span', 'feldname', beschriftung), eingabe);
  return label;
}

function auswahl(optionen, wert, leerText) {
  const s = el('select');
  if (leerText) {
    const o = el('option', null, leerText);
    o.value = '';
    s.append(o);
  }
  for (const { id, name } of optionen) {
    const o = el('option', null, name);
    o.value = String(id);
    s.append(o);
  }
  s.value = wert == null ? '' : String(wert);
  return s;
}

/* ── Anzeige der Aktionen ─────────────────────────────────────────────── */

const TITEL = {
  dm_klicker: 'DM an den Klickenden',
  dm_person: 'DM an eine feste Person',
  rolle: 'Rolle ändern',
};

function zeichneAktionen() {
  aktionsliste.replaceChildren();

  if (aktionen.length === 0) {
    aktionsliste.append(el('p', 'hilfe', 'Noch keine Aktion. Ohne Aktion tut der Button nichts.'));
    return;
  }

  aktionen.forEach((a, index) => {
    const karte = el('div', 'aktion-karte');

    // Kopfzeile mit Nummer, Bezeichnung und Bedienknöpfen
    const kopf = el('div', 'aktion-kopf');
    kopf.append(el('strong', null, `${index + 1}. ${TITEL[a.typ] ?? a.typ}`));

    const knoepfe = el('div', 'knopfreihe');
    if (index > 0) knoepfe.append(bewegenKnopf('↑', 'Nach oben', index, -1));
    if (index < aktionen.length - 1) knoepfe.append(bewegenKnopf('↓', 'Nach unten', index, 1));

    const weg = el('button', 'knopf knopf--gefahr', 'Entfernen');
    weg.type = 'button';
    weg.addEventListener('click', () => {
      aktionen.splice(index, 1);
      zeichneAktionen();
    });
    knoepfe.append(weg);

    kopf.append(knoepfe);
    karte.append(kopf);
    karte.append(...felderFuer(a));
    aktionsliste.append(karte);
  });
}

function bewegenKnopf(zeichen, titel, index, richtung) {
  const b = el('button', 'knopf knopf--leise', zeichen);
  b.type = 'button';
  b.title = titel;
  b.addEventListener('click', () => {
    const ziel = index + richtung;
    [aktionen[index], aktionen[ziel]] = [aktionen[ziel], aktionen[index]];
    zeichneAktionen();
  });
  return b;
}

/** Baut die Eingabefelder passend zum Aktionstyp. */
function felderFuer(a) {
  const bind = (eingabe, schluessel, wandeln = (v) => v) => {
    eingabe.addEventListener('input', () => {
      a[schluessel] = wandeln(eingabe.value);
    });
    return eingabe;
  };

  if (a.typ === 'rolle') {
    const modus = el('select');
    for (const [wert, text] of [
      ['geben', 'Rolle vergeben'],
      ['entfernen', 'Rolle entfernen'],
      ['umschalten', 'Umschalten (hat sie → weg, sonst → dazu)'],
    ]) {
      const o = el('option', null, text);
      o.value = wert;
      modus.append(o);
    }
    modus.value = a.modus ?? 'geben';
    bind(modus, 'modus');
    modus.addEventListener('change', () => {
      a.modus = modus.value;
    });

    const rolle = auswahl(
      daten.rollen.map((r) => ({ id: r.id, name: r.verwaltbar ? r.name : `${r.name} (nicht verwaltbar)` })),
      a.roleId,
      '— Rolle wählen —',
    );
    rolle.addEventListener('change', () => {
      a.roleId = rolle.value;
    });

    const zeile = el('div', 'zeile');
    zeile.append(feld('Was soll passieren?', modus), feld('Rolle', rolle));
    return [zeile];
  }

  const felder = [];

  if (a.typ === 'dm_person') {
    const person = auswahl(
      daten.mitglieder.map((m) => ({ id: m.id, name: m.name })),
      a.userId,
      '— Mitglied wählen —',
    );
    person.addEventListener('change', () => {
      a.userId = person.value;
    });
    felder.push(feld('Empfänger', person));
  }

  const titel = el('input');
  titel.type = 'text';
  titel.maxLength = 256;
  titel.value = a.titel ?? '';
  titel.placeholder = 'Titel (optional — erzeugt ein Embed)';
  bind(titel, 'titel');

  const text = el('textarea');
  text.maxLength = 3000;
  text.value = a.text ?? '';
  text.placeholder = 'Hallo {user}, …';
  bind(text, 'text');

  const vorlage = auswahl(daten.vorlagen, a.templateId, '— ohne Bild —');
  vorlage.addEventListener('change', () => {
    a.templateId = vorlage.value ? Number(vorlage.value) : null;
  });

  felder.push(feld('Titel', titel), feld('Text', text), feld('Bildvorlage', vorlage));
  return felder;
}

/* ── Aktion hinzufügen ────────────────────────────────────────────────── */

const VORLAGEN_AKTION = {
  dm_klicker: () => ({ typ: 'dm_klicker', titel: '', text: '', templateId: null }),
  dm_person: () => ({ typ: 'dm_person', userId: '', titel: '', text: '', templateId: null }),
  rolle: () => ({ typ: 'rolle', modus: 'geben', roleId: '' }),
};

document.getElementById('aktion-hinzufuegen').addEventListener('click', () => {
  const typ = document.getElementById('neue-aktion').value;
  aktionen.push(VORLAGEN_AKTION[typ]());
  zeichneAktionen();
});

/* ── Bearbeiten eines bestehenden Buttons ─────────────────────────────── */

function formularZuruecksetzen() {
  formular.action = `/aktionsleisten/${daten.setId}/buttons`;
  formularTitel.textContent = 'Neuer Button';
  absendenKnopf.textContent = 'Button anlegen';
  abbrechenKnopf.hidden = true;

  formular.querySelector('#f-label').value = '';
  formular.querySelector('#f-emoji').value = '';
  formular.querySelector('#f-style').value = 'primary';
  formular.querySelector('#f-antwort').value = '';
  formular.querySelector('#f-einmal').checked = false;
  formular.querySelector('#f-aktiv').checked = true;
  for (const o of formular.querySelector('#f-rollen').options) o.selected = false;

  aktionen = [];
  zeichneAktionen();
}

for (const knopf of document.querySelectorAll('[data-button-bearbeiten]')) {
  knopf.addEventListener('click', () => {
    const id = Number(knopf.dataset.buttonBearbeiten);
    const b = daten.buttons.find((x) => x.id === id);
    if (!b) return;

    formular.action = `/aktionsleisten/${daten.setId}/buttons/${b.id}`;
    formularTitel.textContent = `Button bearbeiten: ${b.label}`;
    absendenKnopf.textContent = 'Änderungen speichern';
    abbrechenKnopf.hidden = false;

    formular.querySelector('#f-label').value = b.label;
    formular.querySelector('#f-emoji').value = b.emoji ?? '';
    formular.querySelector('#f-style').value = b.style;
    formular.querySelector('#f-antwort').value = b.replyText ?? '';
    formular.querySelector('#f-einmal').checked = b.oncePerUser;
    formular.querySelector('#f-aktiv').checked = b.enabled;
    for (const o of formular.querySelector('#f-rollen').options) {
      o.selected = b.allowedRoleIds.includes(o.value);
    }

    // Kopie, damit ein Abbruch die Anzeige der Tabelle nicht verändert.
    aktionen = structuredClone(b.actions);
    zeichneAktionen();
    document.getElementById('button-formular-karte').scrollIntoView({ behavior: 'smooth' });
  });
}

abbrechenKnopf.addEventListener('click', formularZuruecksetzen);

/* ── Absenden ─────────────────────────────────────────────────────────── */

formular.addEventListener('submit', (e) => {
  // Unvollständige Aktionen früh abfangen: der Server lehnte sie zwar ab, aber
  // mit einer technischen Meldung statt einem brauchbaren Hinweis.
  const unfertig = aktionen.findIndex(
    (a) => (a.typ === 'rolle' && !a.roleId) || (a.typ === 'dm_person' && !a.userId),
  );
  if (unfertig !== -1) {
    e.preventDefault();
    window.alert(`Aktion ${unfertig + 1} ist unvollständig — bitte Rolle bzw. Mitglied auswählen.`);
    return;
  }
  aktionenFeld.value = JSON.stringify(aktionen);
});

zeichneAktionen();
