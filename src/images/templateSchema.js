/**
 * Schema für das Layout einer Bildvorlage.
 *
 * Dasselbe Schema validiert zwei Dinge: den POST-Body aus dem Vorlagen-Editor
 * und das in der Datenbank gespeicherte JSON. Dadurch kann eine alte oder von
 * Hand bearbeitete Vorlage den Renderer nicht mit fehlenden Feldern zum
 * Absturz bringen — fehlende Werte werden mit Standardwerten aufgefüllt.
 */
import { z } from 'zod';

export const MAX_CANVAS = 2000;
export const MIN_CANVAS = 100;

const farbe = z
  .string()
  .regex(/^#[0-9a-fA-F]{3,8}$/, 'Farbe muss ein Hex-Wert sein, z. B. #5865f2')
  .default('#ffffff');

/** Koordinaten dürfen ruhig ausserhalb liegen (Teilanschnitt), aber nicht absurd. */
const koordinate = z.coerce.number().min(-MAX_CANVAS).max(MAX_CANVAS * 2).default(0);

const textBlock = (vorgabe) =>
  z
    .object({
      enabled: z.coerce.boolean().default(true),
      x: koordinate.default(vorgabe.x),
      y: koordinate.default(vorgabe.y),
      text: z.string().max(200).default(vorgabe.text),
      font: z.enum(['Inter Regular', 'Inter Bold']).default(vorgabe.font),
      size: z.coerce.number().int().min(8).max(200).default(vorgabe.size),
      color: farbe.default(vorgabe.color),
      align: z.enum(['left', 'center', 'right']).default('left'),
      maxWidth: z.coerce.number().int().min(50).max(MAX_CANVAS).default(600),
      shadow: z
        .object({
          enabled: z.coerce.boolean().default(false),
          blur: z.coerce.number().min(0).max(50).default(6),
          color: farbe.default('#000000'),
        })
        .prefault({}),
    })
    .prefault({});

export const templateConfigSchema = z.object({
  background: z
    .object({
      color: farbe.default('#1e2124'),
      fit: z.enum(['cover', 'contain', 'stretch']).default('cover'),
    })
    .prefault({}),

  overlay: z
    .object({
      enabled: z.coerce.boolean().default(false),
      color: farbe.default('#000000'),
      opacity: z.coerce.number().min(0).max(1).default(0.35),
    })
    .prefault({}),

  avatar: z
    .object({
      enabled: z.coerce.boolean().default(true),
      x: koordinate.default(80),
      y: koordinate.default(100),
      size: z.coerce.number().int().min(16).max(MAX_CANVAS).default(200),
      shape: z.enum(['circle', 'rounded', 'square']).default('circle'),
      radius: z.coerce.number().int().min(0).max(200).default(24),
      border: z
        .object({
          enabled: z.coerce.boolean().default(true),
          width: z.coerce.number().int().min(0).max(40).default(6),
          color: farbe.default('#5865f2'),
        })
        .prefault({}),
    })
    .prefault({}),

  // Standardlayout: Avatar links (x 80, Grösse 200), Texte rechts daneben.
  username: textBlock({ x: 320, y: 175, text: '{user}', font: 'Inter Bold', size: 56, color: '#ffffff' }),
  subtitle: textBlock({ x: 320, y: 240, text: 'Willkommen auf {guild}!', font: 'Inter Regular', size: 32, color: '#c9ccd1' }),
});

/** Vollständige Standardkonfiguration (alle Felder aufgefüllt). */
export const DEFAULT_CONFIG = templateConfigSchema.parse({});

export const DEFAULT_TEMPLATE = Object.freeze({
  width: 1000,
  height: 400,
  backgroundFile: null,
  config: DEFAULT_CONFIG,
});

/** Kompletter Datensatz einer Vorlage, wie ihn der Editor absendet. */
export const templateInputSchema = z.object({
  name: z.string().trim().min(1, 'Name darf nicht leer sein').max(80),
  kind: z.enum(['welcome', 'role', 'generic']).default('generic'),
  width: z.coerce.number().int().min(MIN_CANVAS).max(MAX_CANVAS).default(1000),
  height: z.coerce.number().int().min(MIN_CANVAS).max(MAX_CANVAS).default(400),
  config: templateConfigSchema.prefault({}),
});

/**
 * Wendet das Schema auf gespeicherte Daten an und liefert immer ein
 * vollständiges Objekt — auch wenn das gespeicherte JSON kaputt ist.
 */
export function normalizeConfig(roh) {
  const res = templateConfigSchema.safeParse(roh ?? {});
  return res.success ? res.data : DEFAULT_CONFIG;
}
