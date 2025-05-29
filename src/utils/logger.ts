import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '../config/config';

// 日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
  })
);

// 控制台输出格式（带颜色）
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
  })
);

// 创建日志传输器
const transports: winston.transport[] = [
  // 控制台输出
  new winston.transports.Console({
    format: consoleFormat,
    level: config.app.logLevel,
  }),
];

// 生产环境添加文件日志
if (config.app.nodeEnv === 'production') {
  // 错误日志
  transports.push(
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      format: logFormat,
      maxSize: '20m',
      maxFiles: '14d',
    })
  );

  // 所有日志
  transports.push(
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      format: logFormat,
      maxSize: '20m',
      maxFiles: '14d',
    })
  );
}

// 创建 logger 实例
export const logger = winston.createLogger({
  level: config.app.logLevel,
  format: logFormat,
  transports,
  exitOnError: false,
});

// 在非生产环境显示更详细的日志
if (config.app.nodeEnv !== 'production') {
  logger.debug('日志系统初始化完成');
} 