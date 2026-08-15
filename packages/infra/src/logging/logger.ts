type Level = 'debug' | 'info' | 'warn' | 'error';

interface LogFields {
  requestId?: string | null;
  userId?: string | null;
  organizationId?: string | null;
  [key: string]: unknown;
}

const REDACT_KEYS = new Set([
  'password', 'token', 'idToken', 'sessionCookie', 'privateKey',
  'authorization', 'cookie', 'nationalId', 'secret',
]);

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACT_KEYS.has(k) ? '[redacted]' : redact(v);
    }
    return out;
  }
  return value;
}

function emit(level: Level, message: string, fields: LogFields = {}) {
  const line = JSON.stringify({
    level,
    message,
    ts: new Date().toISOString(),
    ...(redact(fields) as Record<string, unknown>),
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (m: string, f?: LogFields) => process.env.NODE_ENV !== 'production' && emit('debug', m, f),
  info: (m: string, f?: LogFields) => emit('info', m, f),
  warn: (m: string, f?: LogFields) => emit('warn', m, f),
  error: (m: string, f?: LogFields) => emit('error', m, f),
};
