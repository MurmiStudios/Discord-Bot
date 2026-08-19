/**
 * Session-Speicher auf der bestehenden SQLite-Verbindung.
 *
 * Der Standard-MemoryStore von express-session verliert beim Neustart alle
 * Anmeldungen und wächst unbegrenzt. Fertige SQLite-Stores sind entweder seit
 * Jahren unmaintained oder ziehen einen zweiten SQLite-Treiber mit — die
 * Store-Schnittstelle umfasst nur vier Methoden, das ist billiger als eine
 * tote Abhängigkeit.
 */
import session from 'express-session';

const AUFRAEUM_INTERVALL_MS = 15 * 60 * 1000;

export function createSqliteStore(db) {
  const stmts = {
    get: db.prepare('SELECT data, expires FROM sessions WHERE sid = ?'),
    set: db.prepare(`
      INSERT INTO sessions (sid, expires, data) VALUES (?, ?, ?)
      ON CONFLICT (sid) DO UPDATE SET expires = excluded.expires, data = excluded.data
    `),
    destroy: db.prepare('DELETE FROM sessions WHERE sid = ?'),
    touch: db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?'),
    purge: db.prepare('DELETE FROM sessions WHERE expires < ?'),
    length: db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE expires >= ?'),
    clear: db.prepare('DELETE FROM sessions'),
  };

  function ablauf(sess) {
    const ms = sess?.cookie?.maxAge;
    if (typeof ms === 'number') return Date.now() + ms;
    const datum = sess?.cookie?.expires;
    if (datum) return new Date(datum).getTime();
    return Date.now() + 24 * 60 * 60 * 1000;
  }

  class SqliteStore extends session.Store {
    constructor() {
      super();
      // Abgelaufene Sitzungen regelmässig entfernen. unref, damit der Timer
      // das Beenden des Prozesses nicht verhindert.
      this.timer = setInterval(() => {
        try {
          stmts.purge.run(Date.now());
        } catch {
          /* beim Herunterfahren kann die DB schon zu sein */
        }
      }, AUFRAEUM_INTERVALL_MS);
      this.timer.unref?.();
    }

    get(sid, cb) {
      try {
        const row = stmts.get.get(sid);
        if (!row) return cb(null, null);
        if (row.expires < Date.now()) {
          stmts.destroy.run(sid);
          return cb(null, null);
        }
        return cb(null, JSON.parse(row.data));
      } catch (err) {
        return cb(err);
      }
    }

    set(sid, sess, cb) {
      try {
        stmts.set.run(sid, ablauf(sess), JSON.stringify(sess));
        return cb(null);
      } catch (err) {
        return cb(err);
      }
    }

    destroy(sid, cb) {
      try {
        stmts.destroy.run(sid);
        return cb(null);
      } catch (err) {
        return cb(err);
      }
    }

    touch(sid, sess, cb) {
      try {
        stmts.touch.run(ablauf(sess), sid);
        return cb(null);
      } catch (err) {
        return cb(err);
      }
    }

    length(cb) {
      try {
        return cb(null, stmts.length.get(Date.now()).n);
      } catch (err) {
        return cb(err);
      }
    }

    clear(cb) {
      try {
        stmts.clear.run();
        return cb(null);
      } catch (err) {
        return cb(err);
      }
    }

    stop() {
      clearInterval(this.timer);
    }
  }

  return new SqliteStore();
}
