import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { DatabaseService } from '../models/database.service.js';
import { ApiError } from '../common/api-utils.js';

export type Actor = { accountId: string; userId: string; departmentId: string; roles: Set<string>; doctorId: string | null };
export type ActorRequest = Request & { actor: Actor };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly db: DatabaseService, private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ActorRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new ApiError(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'Authentication required.');
    let sub: string;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(header.slice(7));
      sub = payload.sub;
    } catch {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'Authentication required.');
    }
    const account = await this.db.userAccount.findUnique({ where: { id: sub }, include: { user: { include: { doctor: true } }, roles: true } });
    if (!account?.isActive || !account.user.isActive) throw new ApiError(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'Authentication required.');
    request.actor = { accountId: account.id, userId: account.userId, departmentId: account.departmentId, roles: new Set(account.roles.map((r) => r.roleCode)), doctorId: account.user.doctor?.id ?? null };
    return true;
  }
}
