import pino from 'pino';

export type Logger = pino.Logger;

export const createLogger = (level: string, pretty = false): Logger =>
  pino({
    level,
    base: { service: 'api' },
    redact: ['req.headers.cookie', 'req.headers.authorization', '*.password', '*.token'],
    ...(pretty ? { transport: { target: 'pino/file', options: { destination: 1 } } } : {}),
  });
