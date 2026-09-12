const session = require('express-session');
const db = require('../db');

// Eigener, winziger Sitzungsspeicher auf derselben SQLite-Datei statt einer
// zusaetzlichen nativen Abhaengigkeit -- ein Neustart des Panels wirft
// dadurch niemanden aus der Sitzung.
class SqliteSessionStore extends session.Store {
  constructor() {
    super();
    this.getStmt = db.prepare('SELECT data FROM sessions WHERE sid = @sid AND expires > @now');
    this.upsertStmt = db.prepare(
      `INSERT INTO sessions (sid, data, expires) VALUES (@sid, @data, @expires)
       ON CONFLICT(sid) DO UPDATE SET data = @data, expires = @expires`
    );
    this.destroyStmt = db.prepare('DELETE FROM sessions WHERE sid = @sid');
    this.pruneStmt = db.prepare('DELETE FROM sessions WHERE expires <= @now');
    this.pruneTimer = setInterval(() => this.pruneStmt.run({ now: Date.now() }), 15 * 60 * 1000);
    this.pruneTimer.unref();
  }

  get(sid, cb) {
    try {
      const row = this.getStmt.get({ sid, now: Date.now() });
      cb(null, row ? JSON.parse(row.data) : null);
    } catch (err) {
      cb(err);
    }
  }

  set(sid, sess, cb) {
    try {
      const maxAge = sess.cookie && sess.cookie.maxAge ? sess.cookie.maxAge : 24 * 60 * 60 * 1000;
      this.upsertStmt.run({ sid, data: JSON.stringify(sess), expires: Date.now() + maxAge });
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  destroy(sid, cb) {
    try {
      this.destroyStmt.run({ sid });
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  touch(sid, sess, cb) {
    this.set(sid, sess, cb);
  }
}

module.exports = SqliteSessionStore;
