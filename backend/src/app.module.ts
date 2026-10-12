import { Module } from '@nestjs/common';
import { AppController } from './controllers/app.controller.js';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseService } from './models/database.service.js';
import { AuthController } from './controllers/auth.controller.js';
import { AuthGuard } from './security/auth.guard.js';
import { LoginLimiter } from './security/login-limiter.js';
import { ApiController } from './controllers/api.controller.js';
import { ApiService } from './services/api.service.js';
import { BookingService } from './services/booking.service.js';
import { AuthService } from './services/auth.service.js';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');

@Module({
  imports: [JwtModule.register({ secret: jwtSecret, signOptions: { algorithm: 'HS256', issuer: 'hlab-test', audience: 'hlab-test-api' }, verifyOptions: { algorithms: ['HS256'], issuer: 'hlab-test', audience: 'hlab-test-api' } })],
  controllers: [AppController, AuthController, ApiController],
  providers: [DatabaseService, AuthGuard, LoginLimiter, AuthService, ApiService, BookingService],
})
export class AppModule {}
