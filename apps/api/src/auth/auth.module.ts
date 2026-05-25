import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { PasswordResetService } from './password-reset.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { env } from '../config/env';

@Module({
  imports: [
    JwtModule.register({
      secret: env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: env.ACCESS_TTL },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    PasswordResetService,
    RateLimitGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService, TokenService, JwtModule, RateLimitGuard, PasswordResetService],
})
export class AuthModule {}
