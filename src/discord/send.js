const config = require('../config');
const repo = require('../db/repo');

// Diese Discord-API-Fehlercodes kommen beim DM-Versand staendig vor und
// verdienen einen Klartext-Grund statt der rohen Fehlernummer im Protokoll.
const KNOWN_DM_ERRORS = {
  50007: 'Empfänger nimmt keine Direktnachrichten von Servermitgliedern an',
  50013: 'Bot fehlt die Berechtigung dafür',
  10013: 'Unbekannter Nutzer',
};

function describeError(err) {
  const code = err && err.code;
  if (code && KNOWN_DM_ERRORS[code]) return KNOWN_DM_ERRORS[code];
  return (err && err.message) || 'Unbekannter Fehler';
}

async function sendDm(user, payload) {
  const dm = await user.createDM();
  return dm.send(payload);
}

// Sendet an mehrere Empfaenger nacheinander mit Pause zwischen den DMs.
// buildPayload(user) liefert je Empfaenger den fertigen Payload (Platzhalter
// sind bereits fuer diese Person aufgeloest). onProgress wird nach jedem
// Versand aufgerufen -- damit kann eine SSE-Route den Fortschritt streamen.
async function bulkSendDm(users, buildPayload, { delayMs = config.dmDelayMs, onProgress, actorId, actorTag, logSummary } = {}) {
  const results = { sent: 0, failed: 0, failures: [] };
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    try {
      const payload = await buildPayload(user);
      await sendDm(user, payload);
      results.sent += 1;
      repo.audit.log({
        kind: 'nachricht',
        actorId,
        actorTag,
        summary: `${logSummary || 'DM'} an ${user.tag}`,
        success: true,
      });
    } catch (err) {
      const reason = describeError(err);
      results.failed += 1;
      results.failures.push({ userId: user.id, tag: user.tag, reason });
      repo.audit.log({
        kind: 'nachricht',
        actorId,
        actorTag,
        summary: `${logSummary || 'DM'} an ${user.tag} nicht zugestellt`,
        success: false,
        reason,
      });
    }
    if (onProgress) onProgress({ index: i + 1, total: users.length, ...results });
    if (i < users.length - 1 && delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }
  return results;
}

module.exports = { sendDm, bulkSendDm, describeError };
