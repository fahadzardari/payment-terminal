import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
}

winston.addColors(colors);

// Determine if we're in production
const isProd = process.env.NODE_ENV === 'production';

// Create file transport for errors
const fileErrorTransport = new winston.transports.DailyRotateFile({
  filename: path.join('logs', 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  maxSize: '20m',
  maxFiles: '14d'
});

// Create file transport for all logs
const fileAllTransport = new winston.transports.DailyRotateFile({
  filename: path.join('logs', 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  maxSize: '20m',
  maxFiles: '7d'
});

// Create the Winston logger
const winstonLogger = winston.createLogger({
  level: isProd ? 'info' : 'debug',
  levels,
  transports: [
    // Always log to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(
          (info) => `${info.timestamp} ${info.level}: ${info.message}`
        )
      ),
    }),
  ],
  exitOnError: false,
});

// Add file transports in production
if (isProd) {
  winstonLogger.add(fileErrorTransport);
  winstonLogger.add(fileAllTransport);
}

// Create safe wrapper with error handling while keeping the name "logger"
const logger = {
  error: (message, ...meta) => {
    try {
      winstonLogger.error(message, ...meta);
    } catch (err) {
      console.error('Logger error:', err.message, '| Original message:', message);
    }
  },
  warn: (message, ...meta) => {
    try {
      winstonLogger.warn(message, ...meta);
    } catch (err) {
      console.warn('Logger error:', err.message, '| Original message:', message);
    }
  },
  info: (message, ...meta) => {
    try {
      winstonLogger.info(message, ...meta);
    } catch (err) {
      console.info('Logger error:', err.message, '| Original message:', message);
    }
  },
  debug: (message, ...meta) => {
    try {
      winstonLogger.debug(message, ...meta);
    } catch (err) {
      console.debug('Logger error:', err.message, '| Original message:', message);
    }
  },
  http: (message, ...meta) => {
    try {
      winstonLogger.http(message, ...meta);
    } catch (err) {
      console.log('Logger error:', err.message, '| Original message:', message);
    }
  }
};

export default logger;