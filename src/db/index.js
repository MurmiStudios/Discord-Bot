/**
 * SQLite-Verbindung.
 *
 * better-sqlite3 arbeitet synchron. Das ist hier ein Vorteil: die Repositories
 * bleiben frei von await-Ketten, und Transaktionen sind echte Transaktionen
 * ohne Gefahr, dass sich dazwischen anderer Code einschiebt.
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { runMigrations } from './migrations.js';

/**
 * Öffnet eine Datenbank und bringt sie auf den aktuellen Schemastand.
 * @param {string} file Pfad zur Datei, oder ':memory:' für Tests.
 */
export function openDatabase(file, log = null) {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new Database(file);

  // WAL erlaubt gleichzeitiges Lesen während geschrieben wird — Bot-Prozess
  // und Web-Anfragen greifen auf dieselbe Datei zu.
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  // Wartet, statt sofort mit SQLITE_BUSY abzubrechen, falls doch mal zwei
  // Schreibzugriffe zusammentreffen.
  db.pragma('busy_timeout = 5000');

  runMigrations(db, log);
  return db;
}

let instanz = null;

/** Gibt die gemeinsam genutzte Datenbank zurück (beim ersten Aufruf geöffnet). */
export function getDb() {
  if (!instanz) throw new Error('Datenbank wurde noch nicht initialisiert — initDb() zuerst aufrufen.');
  return instanz;
}

export function initDb(file, log = null) {
  instanz = openDatabase(file, log);
  return instanz;
}

export function closeDb() {
  instanz?.close();
  instanz = null;
}
