/**
 * Schema der Button-Aktionen.
 *
 * Ein Button führt eine geordnete Liste von Aktionen aus. Das Schema validiert
 * sowohl die Eingabe aus dem Panel als auch das gespeicherte JSON — eine alte
 * oder von Hand bearbeitete Aktion kann den Klick-Handler so nicht mit
 * fehlenden Feldern zum Absturz bringen.
 */
import { z } from 'zod';

/** Discords Obergrenzen: 5 Buttons je Reihe, 5 Reihen je Nachricht. */
export const BUTTONS_JE_REIHE = 5;
export const MAX_REIHEN = 5;
export const MAX_BUTTONS = BUTTONS_JE_REIHE * MAX_REIHEN;

export const STILE = ['primary', 'secondary', 'success', 'danger'];

const discordId = z.string().regex(/^\d{5,25}$/, 'Keine gültige Discord-ID');

/** DM an den, der geklickt hat. */
const dmKlicker = z.object({
  typ: z.literal('dm_klicker'),
  titel: z.string().max(256).default(''),
  text: z.string().max(3000).default(''),
  templateId: z.coerce.number().int().nullable().default(null),
});

/** DM an ein fest hinterlegtes Mitglied — etwa eine Benachrichtigung an dich. */
const dmPerson = z.object({
  typ: z.literal('dm_person'),
  userId: discordId,
  titel: z.string().max(256).default(''),
  text: z.string().max(3000).default(''),
  templateId: z.coerce.number().int().nullable().default(null),
});

/**
 * Rolle beim Klickenden ändern.
 * `umschalten` macht Selbstbedienungs-Rollen möglich: hat das Mitglied die
 * Rolle, wird sie entfernt, sonst vergeben.
 */
const rolle = z.object({
  typ: z.literal('rolle'),
  modus: z.enum(['geben', 'entfernen', 'umschalten']),
  roleId: discordId,
});

export const aktionSchema = z.discriminatedUnion('typ', [dmKlicker, dmPerson, rolle]);

export const aktionenSchema = z
  .array(aktionSchema)
  .max(10, 'Höchstens zehn Aktionen je Button')
  .default([]);

export const buttonSchema = z.object({
  label: z.string().trim().min(1, 'Beschriftung darf nicht leer sein').max(80),
  style: z.enum(STILE).default('primary'),
  // Discord akzeptiert Unicode-Emoji direkt; benutzerdefinierte brauchen die
  // Schreibweise <:name:id>, deshalb hier nur eine grosszügige Längengrenze.
  emoji: z.string().trim().max(64).default(''),
  actions: aktionenSchema,
  allowedRoleIds: z.array(discordId).max(25).default([]),
  oncePerUser: z.coerce.boolean().default(false),
  replyText: z.string().max(500).default(''),
  enabled: z.coerce.boolean().default(true),
});

export const setSchema = z.object({
  name: z.string().trim().min(1, 'Name darf nicht leer sein').max(80),
  note: z.string().max(200).default(''),
});

/** Liest gespeichertes JSON und liefert immer eine brauchbare Liste. */
export function normalizeAktionen(roh) {
  const res = aktionenSchema.safeParse(roh ?? []);
  return res.success ? res.data : [];
}

/** Menschenlesbare Kurzfassung einer Aktion für die Übersicht im Panel. */
export function beschreibeAktion(aktion, { rolleName, mitgliedName } = {}) {
  switch (aktion.typ) {
    case 'dm_klicker':
      return 'DM an den Klickenden';
    case 'dm_person':
      return `DM an ${mitgliedName?.(aktion.userId) ?? aktion.userId}`;
    case 'rolle': {
      const name = rolleName?.(aktion.roleId) ?? aktion.roleId;
      const wort = { geben: 'vergeben', entfernen: 'entfernen', umschalten: 'umschalten' };
      return `Rolle „${name}“ ${wort[aktion.modus]}`;
    }
    default:
      return 'Unbekannte Aktion';
  }
}
