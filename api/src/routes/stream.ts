import { Router } from 'express';
import { sseBus } from '../lib/sse.js';

export const streamRouter = Router();

streamRouter.get('/', (req, res) => {
  sseBus.subscribe(res);
});
