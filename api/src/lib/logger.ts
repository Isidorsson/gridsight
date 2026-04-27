import pino from 'pino';
import { env } from './env.js';

const isDev = env.NODE_ENV === 'development';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'gridsight-api' },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.apiKey', '*.password'],
    remove: true,
  },
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname,service' },
    },
  }),
});
