/**
 * Result Type for Consistent Error Handling
 * Provides a consistent way to handle success/error states across services
 */

export type Result<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: {
    kind: string;
    message: string;
    meta?: any;
  };
};

/**
 * Create a successful result
 */
export function ok<T>(data: T): Result<T> {
  return {
    success: true,
    data
  };
}

/**
 * Create an error result
 */
export function err<T>(kind: string, message: string, meta?: any): Result<T> {
  return {
    success: false,
    error: {
      kind,
      message,
      meta
    }
  };
}

/**
 * Wrap a promise to return a Result
 */
export async function wrapResult<T>(
  promise: Promise<T>,
  errorKind: string = 'unknown'
): Promise<Result<T>> {
  try {
    const data = await promise;
    return ok(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(errorKind, message, { originalError: error });
  }
}

/**
 * Map a result to a new type
 */
export function mapResult<T, U>(
  result: Result<T>,
  mapper: (data: T) => U
): Result<U> {
  if (result.success) {
    return ok(mapper(result.data));
  }
  return result as Result<U>;
}

/**
 * Chain results together
 */
export function chainResult<T, U>(
  result: Result<T>,
  mapper: (data: T) => Result<U>
): Result<U> {
  if (result.success) {
    return mapper(result.data);
  }
  return result as Result<U>;
}

/**
 * Get data from result or throw error
 */
export function unwrap<T>(result: Result<T>): T {
  if (result.success) {
    return result.data;
  }
  throw new Error(`${result.error.kind}: ${result.error.message}`);
}

/**
 * Get data from result or return default
 */
export function unwrapOr<T>(result: Result<T>, defaultValue: T): T {
  if (result.success) {
    return result.data;
  }
  return defaultValue;
}