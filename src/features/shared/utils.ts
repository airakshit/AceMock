import { v7 as uuidv7 } from "uuid";

export const generateUUIDv7 = () => uuidv7();

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guards untrusted server-action input before it reaches Postgres —
 * a malformed id would otherwise fail with a driver-level UUID error.
 */
export const isValidUUID = (value: string): boolean => UUID_REGEX.test(value);
