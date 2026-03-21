type LogLevel = 'log' | 'warn' | 'error';

const print = (level: LogLevel, scope: string, message: string, payload?: unknown): void => {
  const text = `[${scope}] ${message}`;

  if (level === 'error') {
    console.error(text, payload ?? '');
    return;
  }

  if (__DEV__) {
    if (level === 'warn') {
      console.warn(text, payload ?? '');
    } else {
      console.log(text, payload ?? '');
    }
  }
};

export const logger = {
  log: (scope: string, message: string, payload?: unknown) => print('log', scope, message, payload),
  warn: (scope: string, message: string, payload?: unknown) => print('warn', scope, message, payload),
  error: (scope: string, message: string, payload?: unknown) => print('error', scope, message, payload),
};
