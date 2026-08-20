/**
 * Helfer, die auf jeder Seite gebraucht werden.
 *
 * Alle Ereignisse werden hier verknüpft, nie über Inline-Handler im Markup —
 * die Content-Security-Policy lässt weder Inline-Skripte noch Inline-Styles zu.
 */

export const csrfToken = () =>
  document.querySelector('meta[name="csrf-token"]')?.content ?? '';

/* ── Seitenleiste auf schmalen Bildschirmen ───────────────────────────── */

const schalter = document.querySelector('[data-leiste-schalter]');
const schleier = document.querySelector('[data-leiste-schliessen]');

function leisteSetzen(offen) {
  document.body.classList.toggle('leiste-offen', offen);
  schalter?.setAttribute('aria-expanded', String(offen));
  if (schleier) schleier.hidden = !offen;
}

schalter?.addEventListener('click', () => {
  leisteSetzen(!document.body.classList.contains('leiste-offen'));
});
schleier?.addEventListener('click', () => leisteSetzen(false));

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') leisteSetzen(false);
});

/* ── Ladeanzeige beim Absenden ────────────────────────────────────────── */

/**
 * Formulare mit `data-laden="…"` sperren beim Absenden ihre Schaltfläche und
 * zeigen den angegebenen Text. Das gibt eine Rückmeldung bei langsamen
 * Vorgängen und verhindert nebenbei doppeltes Absenden — beim Massenversand
 * wäre das sonst eine doppelte DM an jedes Mitglied.
 */
for (const form of document.querySelectorAll('form[data-laden]')) {
  form.addEventListener('submit', () => {
    const knopf = form.querySelector('button[type="submit"], button:not([type])');
    if (!knopf || knopf.dataset.laeuft) return;

    knopf.dataset.laeuft = '1';
    knopf.setAttribute('aria-busy', 'true');
    knopf.disabled = true;
    knopf.textContent = form.dataset.laden;

    // Kommt der Nutzer über den Zurück-Knopf auf die Seite, liefert der
    // Browser sie aus dem Verlaufsspeicher — die Schaltfläche wäre sonst
    // dauerhaft gesperrt.
    window.addEventListener('pageshow', () => {
      delete knopf.dataset.laeuft;
      knopf.removeAttribute('aria-busy');
      knopf.disabled = false;
    });
  });
}

/* ── Auswahlfelder, die ihr Formular sofort absenden ──────────────────── */

/**
 * Ersetzt `onchange="this.form.submit()"` im Markup — Inline-Handler sind
 * durch die Content-Security-Policy gesperrt und blieben wirkungslos.
 */
for (const feld of document.querySelectorAll('[data-sofort-absenden]')) {
  feld.addEventListener('change', () => feld.form?.submit());
}

/* ── Sicherheitsabfrage vor dem Löschen ───────────────────────────────── */

for (const form of document.querySelectorAll('form[data-bestaetigen]')) {
  form.addEventListener('submit', (e) => {
    if (!window.confirm(form.dataset.bestaetigen)) e.preventDefault();
  });
}

/* ── Fortschritt eines Versandauftrags ────────────────────────────────── */

const auftrag = document.getElementById('auftrag');
if (auftrag) {
  const id = auftrag.dataset.id;
  const setze = (sel, wert) => {
    const el = document.getElementById(sel);
    if (el) el.textContent = wert;
  };

  const aktualisieren = async () => {
    try {
      const res = await fetch(`/api/auftrag/${id}`);
      if (!res.ok) return true; // Auftrag abgelaufen — Abfrage beenden
      const a = await res.json();

      setze('z-erledigt', a.erledigt);
      setze('z-erfolg', a.erfolg);
      setze('z-fehler', a.fehler);
      setze(
        'z-status',
        a.fertig
          ? 'Versand abgeschlossen.'
          : `Versand läuft — ${a.erledigt} von ${a.gesamt} verarbeitet.`,
      );

      const koerper = document.getElementById('z-zeilen');
      if (koerper) {
        koerper.replaceChildren(
          ...a.ergebnisse.map((e) => {
            const tr = document.createElement('tr');

            const name = document.createElement('td');
            name.textContent = e.label ?? '—';

            const status = document.createElement('td');
            const span = document.createElement('span');
            span.className = `abzeichen abzeichen--${e.ok ? 'ok' : 'failed'}`;
            span.textContent = e.ok ? 'Zugestellt' : 'Fehlgeschlagen';
            status.append(span);

            const grund = document.createElement('td');
            grund.textContent = e.grund ?? '';

            tr.append(name, status, grund);
            return tr;
          }),
        );
      }
      return a.fertig;
    } catch {
      return false;
    }
  };

  const timer = setInterval(async () => {
    if (await aktualisieren()) clearInterval(timer);
  }, 1500);
}
