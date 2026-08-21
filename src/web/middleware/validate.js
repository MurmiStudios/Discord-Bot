/**
 * Prüft Formular- und JSON-Eingaben mit einem zod-Schema, bevor sie die
 * Datenbank oder Discord erreichen.
 */
export function validate(schema, quelle = 'body') {
  return (req, res, next) => {
    const ergebnis = schema.safeParse(req[quelle]);
    if (!ergebnis.success) {
      const fehler = ergebnis.error.issues.map((i) => ({
        feld: i.path.join('.'),
        meldung: i.message,
      }));

      // Für fetch-Aufrufe aus dem Editor JSON, für Formulare eine Seite.
      if (req.accepts(['html', 'json']) === 'json') {
        return res.status(400).json({ ok: false, fehler });
      }
      return res.status(400).render('error', {
        titel: 'Eingabe unvollständig',
        nachricht: fehler.map((f) => `${f.feld}: ${f.meldung}`).join('\n'),
        zeigeAbmelden: false,
      });
    }
    // Geprüfte Daten weiterreichen. req.query ist in Express 5 nur lesbar,
    // deshalb landet das Ergebnis in einem eigenen Feld.
    req.geprueft = ergebnis.data;
    return next();
  };
}
