import { HttpException, HttpStatus } from '@nestjs/common';

export class ApiError extends HttpException {
  constructor(status: HttpStatus, code: string, message: string) {
    super({ error: { code, message, details: [] } }, status);
  }
}

export function bad(message: string): never {
  throw new ApiError(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', message);
}

export function forbidden(): never {
  throw new ApiError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'You do not have access to this resource.');
}

export function notFound(): never {
  throw new ApiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Resource not found.');
}

export function conflict(code: string, message: string): never {
  throw new ApiError(HttpStatus.CONFLICT, code, message);
}

export function object(value: unknown, allowed: string[], required: string[] = []): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) bad('A JSON object is required.');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !allowed.includes(key))) bad('Request contains an unsupported field.');
  if (required.some((key) => record[key] === undefined || record[key] === null)) bad('A required field is missing.');
  return record;
}

export function string(value: unknown, name: string, max = 255): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) bad(`Invalid ${name}.`);
  return value.trim();
}

export function optionalString(value: unknown, name: string, max = 1000): string | null {
  if (value === undefined || value === null || value === '') return null;
  return string(value, name, max);
}

export function uuid(value: unknown, name: string): string {
  const result = string(value, name, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result)) bad(`Invalid ${name}.`);
  return result;
}

export function dateOnly(value: unknown, name: string): string {
  const result = string(value, name, 10);
  const parsed = new Date(`${result}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result) bad(`Invalid ${name}.`);
  return result;
}

export function timeOnly(value: unknown, name: string): string {
  const result = string(value, name, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(result)) bad(`Invalid ${name}.`);
  return result;
}

export function boolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') bad(`Invalid ${name}.`);
  return value;
}

export function utcDate(value: unknown, name: string): Date {
  const result = string(value, name, 35);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(result)) bad(`Invalid ${name}.`);
  const date = new Date(result);
  if (Number.isNaN(date.getTime())) bad(`Invalid ${name}.`);
  return date;
}

export function page(query: Record<string, unknown>): { page: number; pageSize: number; skip: number } {
  const p = query.page === undefined ? 1 : Number(query.page);
  const s = query.pageSize === undefined ? 20 : Number(query.pageSize);
  if (!Number.isInteger(p) || p < 1 || !Number.isInteger(s) || s < 1 || s > 100) bad('Invalid pagination.');
  return { page: p, pageSize: s, skip: (p - 1) * s };
}

export function collection<T>(data: T[], total: number, pagination: { page: number; pageSize: number }) {
  return { data, meta: { page: pagination.page, pageSize: pagination.pageSize, total } };
}

export function localTimestamp(day: string, time: string): Date {
  // Hospital time zone is fixed to Asia/Bangkok (UTC+07:00) for this assignment.
  return new Date(`${day}T${time}:00+07:00`);
}

export function timeText(value: Date): string {
  return value.toISOString().slice(11, 16);
}

export function dateText(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function timeValue(value: string): Date {
  return new Date(`1970-01-01T${value}:00Z`);
}

export function dateValue(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}
