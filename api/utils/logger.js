import winston from 'winston';
import { format } from 'winston';

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

const logDir = process.env.LOG_DIR || './logs';

const customFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.json(),
  format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let logString = JSON.stringify({
      timestamp,
      level,
      message,
      ...meta
    });
    
    if (stack) {
      logString = logString.slice(0, -1) + `,"stack":"${stack.replace(/"/g, '\\"')}"}`;
    }
    
    return logString;
  })
);

const logger = winston.createLogger({
  level: isDevelopment ? 'debug' : 'info',
  format: customFormat,
  defaultMeta: { 
    service: 'vegetable-harvest-api',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    new winston.transports.Console({
      format: isDevelopment 
        ? format.combine(
            format.colorize(),
            format.simple(),
            format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
              return `${timestamp} [${level}]: ${message} ${metaStr}`;
            })
          )
        : customFormat
    })
  ],
  exitOnError: false
});

if (isProduction) {
  logger.add(new winston.transports.File({
    filename: `${logDir}/error.log`,
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    format: customFormat
  }));

  logger.add(new winston.transports.File({
    filename: `${logDir}/combined.log`,
    maxsize: 5242880, // 5MB
    maxFiles: 10,
    format: customFormat
  }));
}

export function logAPIAccess(req, res, responseTime, statusCode) {
  const logData = {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    statusCode,
    responseTime: `${responseTime}ms`,
    userId: req.user?.id || 'anonymous',
    timestamp: new Date().toISOString()
  };

  if (statusCode >= 400) {
    logger.warn('API Error Response', logData);
  } else {
    logger.info('API Access', logData);
  }
}

export function logLINEWebhook(event, userId, response) {
  logger.info('LINE Webhook Event', {
    type: 'line_webhook',
    eventType: event?.type,
    userId: userId || 'unknown',
    messageType: event?.message?.type,
    response: response ? 'success' : 'failed',
    timestamp: new Date().toISOString()
  });
}

export function logLINEMessage(userId, messageType, success, error = null) {
  const logData = {
    type: 'line_message_send',
    userId,
    messageType,
    success,
    timestamp: new Date().toISOString()
  };

  if (error) {
    logData.error = error.message || error;
    logger.error('LINE Message Send Failed', logData);
  } else {
    logger.info('LINE Message Sent', logData);
  }
}

export function logDatabaseOperation(operation, table, success, error = null, meta = {}) {
  const logData = {
    type: 'database_operation',
    operation,
    table,
    success,
    timestamp: new Date().toISOString(),
    ...meta
  };

  if (error) {
    logData.error = error.message || error;
    logger.error('Database Operation Failed', logData);
  } else {
    logger.info('Database Operation', logData);
  }
}

export function logAuthentication(userId, action, success, error = null, meta = {}) {
  const logData = {
    type: 'authentication',
    userId: userId || 'unknown',
    action,
    success,
    timestamp: new Date().toISOString(),
    ...meta
  };

  if (error) {
    logData.error = error.message || error;
    logger.warn('Authentication Failed', logData);
  } else {
    logger.info('Authentication Event', logData);
  }
}

export function logSystemEvent(event, level = 'info', meta = {}) {
  const logData = {
    type: 'system_event',
    event,
    timestamp: new Date().toISOString(),
    ...meta
  };

  logger[level]('System Event', logData);
}

export function logError(error, context = '', userId = null, meta = {}) {
  const logData = {
    type: 'application_error',
    context,
    userId: userId || 'unknown',
    errorMessage: error.message || error,
    errorStack: error.stack,
    timestamp: new Date().toISOString(),
    ...meta
  };

  logger.error('Application Error', logData);
}

export function logPerformanceMetric(metric, value, unit = 'ms', meta = {}) {
  const logData = {
    type: 'performance_metric',
    metric,
    value,
    unit,
    timestamp: new Date().toISOString(),
    ...meta
  };

  logger.info('Performance Metric', logData);
}

export function logSecurityEvent(event, severity = 'medium', userId = null, meta = {}) {
  const logData = {
    type: 'security_event',
    event,
    severity,
    userId: userId || 'unknown',
    timestamp: new Date().toISOString(),
    ...meta
  };

  const logLevel = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
  logger[logLevel]('Security Event', logData);
}

export function createRequestLogger() {
  return (req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      logAPIAccess(req, res, responseTime, res.statusCode);
    });
    
    next();
  };
}

export function createErrorLogger() {
  return (error, req, res, next) => {
    logError(error, `API Error: ${req.method} ${req.url}`, req.user?.id, {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress
    });
    
    next(error);
  };
}

export default logger;