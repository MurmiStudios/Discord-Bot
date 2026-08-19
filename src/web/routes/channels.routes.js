import express from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { flashUndZurueck } from '../middleware/locals.js';
import { listeKanaele, sendToChannel } from '../../bot/services/channel.service.js';
import { limits } from '../security.js';

const eingabe = z.object({
  channelId: z.string().min(1, 'Bitte einen Kanal auswählen'),
  title: z.string().max(256).default(''),
  content: z.string().max(4000).default(''),
});

export function channelRoutes({ repos, config, getKontext }) {
  const router = express.Router();

  router.get('/kanaele', (req, res) => {
    const { guild } = getKontext();
    res.render('channels', {
      titel: 'Kanal-Nachricht',
      kanaele: guild ? listeKanaele(guild) : [],
    });
  });

  router.post('/kanaele', limits.versand, validate(eingabe), async (req, res) => {
    const { guild } = getKontext();
    if (!guild) return flashUndZurueck(req, res, 'fehler', 'Der Bot ist nicht mit dem Server verbunden.', '/kanaele');

    const { channelId, title, content } = req.geprueft;
    if (!title && !content.trim()) {
      return flashUndZurueck(req, res, 'fehler', 'Bitte gib einen Titel oder einen Text ein.', '/kanaele');
    }

    const ergebnis = await sendToChannel(guild, channelId, { content, title });

    repos.log.add(config.GUILD_ID, {
      kind: 'channel',
      status: ergebnis.ok ? 'ok' : 'failed',
      actorId: req.session.user.id,
      targetChannelId: channelId,
      detail: ergebnis.ok ? 'Nachricht gesendet' : ergebnis.grund,
      payloadExcerpt: content || title,
    });

    return flashUndZurueck(
      req,
      res,
      ergebnis.ok ? 'erfolg' : 'fehler',
      ergebnis.ok
        ? `Nachricht wurde in #${guild.channels.cache.get(channelId)?.name ?? channelId} gesendet.`
        : `Senden fehlgeschlagen: ${ergebnis.grund}`,
      '/kanaele',
    );
  });

  return router;
}
