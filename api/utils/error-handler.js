// Unified Error Handler for Vegetable Harvest Management System

/**
 * Creates a standardized error response
 * @param {Error|string} error - Error object or message
 * @param {number} statusCode - HTTP status code
 * @param {object} meta - Additional metadata
 * @returns {object} Formatted error response with status code
 */
export function createErrorResponse(error, statusCode = 500, meta = {}) {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorCode = error.code || getErrorCodeFromStatus(statusCode);
  
  const errorResponse = {
    success: false,
    error: errorMessage || 'サーバーエラーが発生しました',
    code: errorCode,
    timestamp: new Date().toISOString(),
    ...meta
  };
  
  // Include stack trace only in development
  if (process.env.NODE_ENV !== 'production' && error.stack) {
    errorResponse.stack = error.stack;
  }
  
  // Add request ID if available
  if (meta.requestId) {
    errorResponse.requestId = meta.requestId;
  }
  
  return { response: errorResponse, statusCode };
}

/**
 * Creates a validation error response
 * @param {string} field - Field name that failed validation
 * @param {string} message - Validation error message
 * @param {object} additionalFields - Additional validation errors
 * @returns {object} Validation error response
 */
export function createValidationError(field, message, additionalFields = {}) {
  const errors = { [field]: message, ...additionalFields };
  
  return {
    success: false,
    error: 'バリデーションエラーが発生しました',
    code: 'VALIDATION_ERROR',
    timestamp: new Date().toISOString(),
    field: field,
    fields: errors,
    details: Object.keys(errors).map(key => `${key}: ${errors[key]}`)
  };
}

/**
 * Creates an authentication error response
 * @param {string} message - Authentication error message
 * @param {string} reason - Specific reason for auth failure
 * @returns {object} Authentication error response
 */
export function createAuthError(message = '認証が必要です', reason = 'MISSING_TOKEN') {
  return {
    success: false,
    error: message,
    code: 'AUTH_ERROR',
    timestamp: new Date().toISOString(),
    reason: reason,
    action: 'ログインしてください'
  };
}

/**
 * Creates a permission error response
 * @param {string} message - Permission error message
 * @param {string} requiredRole - Required role for the action
 * @param {string} userRole - Current user's role
 * @returns {object} Permission error response
 */
export function createPermissionError(
  message = '権限がありません', 
  requiredRole = null, 
  userRole = null
) {
  const errorResponse = {
    success: false,
    error: message,
    code: 'PERMISSION_ERROR',
    timestamp: new Date().toISOString()
  };
  
  if (requiredRole) {
    errorResponse.requiredRole = requiredRole;
  }
  
  if (userRole) {
    errorResponse.currentRole = userRole;
  }
  
  return errorResponse;
}

/**
 * Creates a not found error response
 * @param {string} resource - The resource that was not found
 * @param {string} identifier - The identifier used to search
 * @returns {object} Not found error response
 */
export function createNotFoundError(resource = 'リソース', identifier = null) {
  const errorResponse = {
    success: false,
    error: `${resource}が見つかりません`,
    code: 'NOT_FOUND',
    timestamp: new Date().toISOString(),
    resource: resource
  };
  
  if (identifier) {
    errorResponse.identifier = identifier;
  }
  
  return errorResponse;
}

/**
 * Creates a rate limit error response
 * @param {number} limit - Rate limit
 * @param {number} window - Time window in seconds
 * @param {number} retryAfter - Seconds until retry is allowed
 * @returns {object} Rate limit error response
 */
export function createRateLimitError(limit, window, retryAfter) {
  return {
    success: false,
    error: 'レート制限に達しました',
    code: 'RATE_LIMIT_ERROR',
    timestamp: new Date().toISOString(),
    limit: limit,
    window: window,
    retryAfter: retryAfter
  };
}

/**
 * Creates a conflict error response (e.g., duplicate data)
 * @param {string} message - Conflict error message
 * @param {string} conflictField - Field that caused the conflict
 * @param {any} conflictValue - Value that caused the conflict
 * @returns {object} Conflict error response
 */
export function createConflictError(message, conflictField = null, conflictValue = null) {
  const errorResponse = {
    success: false,
    error: message,
    code: 'CONFLICT_ERROR',
    timestamp: new Date().toISOString()
  };
  
  if (conflictField) {
    errorResponse.conflictField = conflictField;
  }
  
  if (conflictValue) {
    errorResponse.conflictValue = conflictValue;
  }
  
  return errorResponse;
}

/**
 * Creates a service unavailable error response
 * @param {string} service - Service that is unavailable
 * @param {string} reason - Reason for unavailability
 * @returns {object} Service unavailable error response
 */
export function createServiceUnavailableError(service = 'サービス', reason = 'MAINTENANCE') {
  return {
    success: false,
    error: `${service}は現在利用できません`,
    code: 'SERVICE_UNAVAILABLE',
    timestamp: new Date().toISOString(),
    service: service,
    reason: reason
  };
}

/**
 * Gets appropriate error code based on HTTP status
 * @param {number} statusCode - HTTP status code
 * @returns {string} Error code
 */
function getErrorCodeFromStatus(statusCode) {
  const statusMap = {
    400: 'BAD_REQUEST',
    401: 'AUTH_ERROR',
    403: 'PERMISSION_ERROR',
    404: 'NOT_FOUND',
    409: 'CONFLICT_ERROR',
    422: 'VALIDATION_ERROR',
    429: 'RATE_LIMIT_ERROR',
    500: 'SERVER_ERROR',
    502: 'BAD_GATEWAY',
    503: 'SERVICE_UNAVAILABLE',
    504: 'GATEWAY_TIMEOUT'
  };
  
  return statusMap[statusCode] || 'UNKNOWN_ERROR';
}

/**
 * Handles database errors specifically
 * @param {Error} error - Database error
 * @returns {object} Formatted database error response
 */
export function handleDatabaseError(error) {
  console.error('Database Error:', error);
  
  // Handle specific Supabase/PostgreSQL errors
  if (error.code === '23505') {
    return createConflictError('データが既に存在します', null, null);
  }
  
  if (error.code === '23503') {
    return createValidationError('関連データ', '参照されているデータが存在しません');
  }
  
  if (error.message?.includes('duplicate key')) {
    return createConflictError('データが既に存在します');
  }
  
  if (error.message?.includes('foreign key')) {
    return createValidationError('関連データ', '無効な関連データが指定されました');
  }
  
  if (error.message?.includes('not null')) {
    return createValidationError('必須項目', '必須項目が入力されていません');
  }
  
  // Generic database error
  return createErrorResponse('データベースエラーが発生しました', 500, {
    type: 'DATABASE_ERROR'
  });
}

/**
 * Handles LINE API errors specifically
 * @param {Error} error - LINE API error
 * @returns {object} Formatted LINE API error response
 */
export function handleLineApiError(error) {
  console.error('LINE API Error:', error);
  
  const statusCode = error.response?.status || 500;
  const errorData = error.response?.data || {};
  
  if (statusCode === 401) {
    return createAuthError('LINE API認証エラー', 'INVALID_CHANNEL_TOKEN');
  }
  
  if (statusCode === 403) {
    return createPermissionError('LINE APIアクセス権限がありません');
  }
  
  if (statusCode === 429) {
    return createRateLimitError(
      errorData.limit || 1000,
      3600,
      parseInt(error.response?.headers?.['retry-after']) || 3600
    );
  }
  
  return createErrorResponse(`LINE APIエラー: ${errorData.message || error.message}`, statusCode, {
    type: 'LINE_API_ERROR',
    lineErrorCode: errorData.code
  });
}

/**
 * Express.js error handling middleware
 * @param {Error} err - Error object
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next function
 */
export function errorHandlerMiddleware(err, req, res, next) {
  // Log the error
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}:`, err);
  
  let errorResponse;
  let statusCode = 500;
  
  // Handle different types of errors
  if (err.name === 'ValidationError') {
    errorResponse = createValidationError('入力データ', err.message);
    statusCode = 400;
  } else if (err.name === 'CastError') {
    errorResponse = createValidationError('データ形式', '無効なデータ形式です');
    statusCode = 400;
  } else if (err.code === 11000) {
    errorResponse = createConflictError('データが既に存在します');
    statusCode = 409;
  } else if (err.message?.includes('LINE API')) {
    const lineError = handleLineApiError(err);
    errorResponse = lineError.response || lineError;
    statusCode = lineError.statusCode || 500;
  } else if (err.message?.includes('database') || err.code?.startsWith('23')) {
    const dbError = handleDatabaseError(err);
    errorResponse = dbError.response || dbError;
    statusCode = dbError.statusCode || 500;
  } else {
    const genericError = createErrorResponse(err, statusCode);
    errorResponse = genericError.response;
    statusCode = genericError.statusCode;
  }
  
  // Send error response
  res.status(statusCode).json(errorResponse);
}

/**
 * Async error wrapper for route handlers
 * @param {function} fn - Async route handler function
 * @returns {function} Wrapped function with error handling
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validates required fields in request body
 * @param {object} body - Request body
 * @param {array} requiredFields - Array of required field names
 * @returns {object|null} Validation error or null if valid
 */
export function validateRequiredFields(body, requiredFields) {
  const missingFields = [];
  const invalidFields = {};
  
  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      missingFields.push(field);
    }
  }
  
  if (missingFields.length > 0) {
    for (const field of missingFields) {
      invalidFields[field] = '必須項目です';
    }
    
    return createValidationError(
      missingFields[0], 
      '必須項目です', 
      invalidFields
    );
  }
  
  return null;
}

// Export error types for consistency
export const ErrorTypes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT_ERROR: 'CONFLICT_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  LINE_API_ERROR: 'LINE_API_ERROR',
  SERVER_ERROR: 'SERVER_ERROR'
};

export default {
  createErrorResponse,
  createValidationError,
  createAuthError,
  createPermissionError,
  createNotFoundError,
  createRateLimitError,
  createConflictError,
  createServiceUnavailableError,
  handleDatabaseError,
  handleLineApiError,
  errorHandlerMiddleware,
  asyncHandler,
  validateRequiredFields,
  ErrorTypes
};