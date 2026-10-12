import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { DatabaseService } from '../models/database.service.js';
import { ApiError, object, string } from '../common/api-utils.js';
import type { Actor } from '../security/auth.guard.js';
import { LoginLimiter } from '../security/login-limiter.js';

@Injectable()
export class AuthService {
  private readonly dummyHash = argon2.hash('not-a-real-account-password');

  constructor(private readonly db: DatabaseService, private readonly jwt: JwtService, private readonly limiter: LoginLimiter) {}

  async departments(query: Record<string, unknown>) {
    const q = query.q === undefined ? undefined : string(query.q, 'q', 120);
    const rows = await this.db.department.findMany({ where: q ? { OR: [{ code: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }] } : undefined, select: { code: true, name: true }, orderBy: { code: 'asc' }, take: 100 });
    return { data: rows };
  }

  async login(body: unknown, key: string) {
    const data = object(body, ['departmentCode', 'email', 'password'], ['departmentCode', 'email', 'password']);
    const departmentCode = string(data.departmentCode, 'departmentCode', 32);
    const email = string(data.email, 'email', 254);
    const password = string(data.password, 'password', 1024);
    this.limiter.check(key);
    const invalid = () => new ApiError(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Invalid credentials.');
    const account = await this.db.userAccount.findUnique({ where: { email }, include: { department: true, user: { include: { doctor: true, userType: true } }, roles: true } });
    if (!account || !account.isActive || !account.user.isActive || account.department.code !== departmentCode || (account.user.doctor && account.user.doctor.primaryDepartmentId !== account.departmentId)) {
      await argon2.verify(await this.dummyHash, password);
      this.limiter.failure(key);
      throw invalid();
    }
    if (!(await argon2.verify(account.passwordHash, password))) {
      this.limiter.failure(key);
      throw invalid();
    }
    this.limiter.success(key);
    const accessToken = await this.jwt.signAsync({ sub: account.id }, { expiresIn: '15m' });
    return { data: { accessToken, tokenType: 'Bearer', expiresInSeconds: 900, account: { id: account.id, userId: account.userId, userType: { code: account.user.userType.code, name: account.user.userType.name }, department: { id: account.department.id, code: account.department.code, name: account.department.name }, roles: account.roles.map((r) => r.roleCode) } } };
  }

  async me(actor: Actor) {
    const account = await this.db.userAccount.findUniqueOrThrow({ where: { id: actor.accountId }, include: { department: true, user: { include: { userType: true } } } });
    return { data: { id: account.id, userId: account.userId, userType: { code: account.user.userType.code, name: account.user.userType.name }, department: { id: account.department.id, code: account.department.code, name: account.department.name }, roles: [...actor.roles] } };
  }
}
