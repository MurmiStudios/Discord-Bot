/**
 * Bündelt alle Repositories zu einem Objekt. Jedes Repository bereitet seine
 * Statements einmal beim Erzeugen vor, deshalb gibt es genau eine Instanz je
 * Datenbankverbindung.
 */
import { createSettingsRepo } from './settings.repo.js';
import { createTemplatesRepo } from './templates.repo.js';
import { createRoleRulesRepo } from './roleRules.repo.js';
import { createRoleMessagesRepo } from './roleMessages.repo.js';
import { createMemberRolesRepo } from './memberRoles.repo.js';
import { createLogRepo } from './log.repo.js';

export function createRepos(db) {
  return {
    settings: createSettingsRepo(db),
    templates: createTemplatesRepo(db),
    roleRules: createRoleRulesRepo(db),
    roleMessages: createRoleMessagesRepo(db),
    memberRoles: createMemberRolesRepo(db),
    log: createLogRepo(db),
  };
}

let instanz = null;

export function initRepos(db) {
  instanz = createRepos(db);
  return instanz;
}

export function getRepos() {
  if (!instanz) throw new Error('Repositories wurden noch nicht initialisiert.');
  return instanz;
}
