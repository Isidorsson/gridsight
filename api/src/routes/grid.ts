import { Router } from 'express';
import { z } from 'zod';
import { BadRequest, NotFound } from '../lib/errors.js';
import {
  getAllSummaries,
  getMix,
  getPrices,
  getZone,
  getZoneSummary,
  listZones,
  type DataSource,
} from '../domain/grid.js';

export const gridRouter = Router();

const SourceQuery = z.object({
  source: z.enum(['auto', 'mock', 'live']).default('auto'),
});

const ZoneQuery = SourceQuery.extend({
  zone: z.string().min(1),
});

gridRouter.get('/zones', (_req, res) => {
  res.json({ items: listZones() });
});

gridRouter.get('/summary', async (req, res, next) => {
  try {
    const { source } = SourceQuery.parse(req.query);
    const items = await getAllSummaries(source as DataSource);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

gridRouter.get('/mix', async (req, res, next) => {
  try {
    const { zone, source } = ZoneQuery.parse(req.query);
    if (!getZone(zone)) throw NotFound(`Bidding zone ${zone}`);
    const mix = await getMix(zone, source as DataSource);
    res.json(mix);
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unknown bidding zone')) {
      next(BadRequest(err.message));
      return;
    }
    next(err);
  }
});

gridRouter.get('/prices', async (req, res, next) => {
  try {
    const { zone, source } = ZoneQuery.parse(req.query);
    if (!getZone(zone)) throw NotFound(`Bidding zone ${zone}`);
    const prices = await getPrices(zone, source as DataSource);
    res.json(prices);
  } catch (err) {
    next(err);
  }
});

gridRouter.get('/zone/:code', async (req, res, next) => {
  try {
    const { source } = SourceQuery.parse(req.query);
    const zone = getZone(req.params.code);
    if (!zone) throw NotFound(`Bidding zone ${req.params.code}`);
    const summary = await getZoneSummary(zone.code, source as DataSource);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});
