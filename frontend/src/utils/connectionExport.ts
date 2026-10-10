type JsonObject = Record<string, unknown>;

const isJsonObject = (value: unknown): value is JsonObject => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export const BACKEND_CANCELLED_MESSAGE = '已取消';

export const isBackendCancelledResult = (result: unknown): boolean => (
  isJsonObject(result)
  && result.success === false
  && result.message === BACKEND_CANCELLED_MESSAGE
);
