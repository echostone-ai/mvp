// src/lib/logger.ts
import pino from 'pino'

// Avoid worker-based transports in development/serverless environments
const isDev = process.env.NODE_ENV !== 'production'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: ['req.headers.authorization', 'user.email', 'user.name', 'address', 'message', 'text', 'prompt'],
    remove: true,
  },
  // Enhanced serializers for better error logging
  serializers: {
    err: pino.stdSerializers.err,
    error: (error: any) => {
      if (error instanceof Error) {
        return {
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: error.cause
        }
      }
      return error
    }
  },
  // Do not configure transport in dev to prevent worker thread crashes
  transport: isDev ? undefined : undefined,
})

// Enhanced console logging for development
if (isDev) {
  const originalError = console.error
  console.error = (...args: any[]) => {
    // Ensure error objects are properly stringified
    const processedArgs = args.map(arg => {
      if (arg instanceof Error) {
        return {
          name: arg.name,
          message: arg.message,
          stack: arg.stack,
          cause: arg.cause
        }
      }
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2)
        } catch {
          return String(arg)
        }
      }
      return arg
    })
    originalError.apply(console, processedArgs)
  }
}


