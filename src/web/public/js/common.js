/** Kleine Helfer, die auf jeder Seite gebraucht werden. */

export const csrfToken = () =>
  document.querySelector('meta[name="csrf-token"]')?.content ?? '';

/** Formulare mit data-bestaetigen fragen vor dem Absenden nach. */
document.querySelectorAll('form[data-bestaetigen]').forEach((form) => {
  form.addEventListener('submit', (e) => {
    if (!window.confirm(form.dataset.bestaetigen)) e.preventDefault();
  });
});

/** Fortschritt eines Versandauftrags nachladen. */
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
      setze('z-status', a.fertig ? 'Versand abgeschlossen.' : 'Versand läuft — die Seite aktualisiert sich automatisch.');

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
