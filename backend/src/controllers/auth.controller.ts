import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../services/auth.service.js';
import { AuthGuard, type ActorRequest } from '../security/auth.guard.js';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('departments')
  departments(@Query() query: Record<string, unknown>) { return this.auth.departments(query); }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: unknown, @Req() req: Request) { return this.auth.login(body, req.socket.remoteAddress ?? 'unknown'); }

  @UseGuards(AuthGuard)
  @Get('me')
  me(@Req() req: ActorRequest) { return this.auth.me(req.actor); }
}
