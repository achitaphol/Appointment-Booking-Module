import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-utils.js';

@Injectable()
export class LoginLimiter {
  private readonly attempts = new Map<string, { count: number; resetAt: number }>();

  check(key: string): void {
    const now = Date.now();
    const record = this.attempts.get(key);
    if (record && record.resetAt > now && record.count >= 5) {
      throw new ApiError(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED', 'Too many login attempts. Try again later.');
    }
  }

  failure(key: string): void {
    const now = Date.now();
    const previous = this.attempts.get(key);
    const next = previous && previous.resetAt > now ? { count: previous.count + 1, resetAt: previous.resetAt } : { count: 1, resetAt: now + 300_000 };
    this.attempts.set(key, next);
    if (this.attempts.size > 10_000) {
      for (const [storedKey, value] of this.attempts) if (value.resetAt <= now) this.attempts.delete(storedKey);
    }
  }

  success(key: string): void {
    this.attempts.delete(key);
  }
}
