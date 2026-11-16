import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { IsEmail, IsString } from 'class-validator';
import type { LoginResponse } from '@engie/shared';
import { ActivityService } from '../activity/activity.service.js';
import { Db } from '../db/db.service.js';
import { AuthTokens, Public } from './auth.js';

class LoginDto {
  @IsEmail()
  email: string;

  /** Any password is accepted in the demo. */
  @IsString()
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly db: Db,
    private readonly tokens: AuthTokens,
    private readonly activity: ActivityService,
  ) {}

  @Public()
  @Post('login')
  async login(@Body() body: LoginDto): Promise<LoginResponse> {
    const user = await this.db.users.findOne({ email: body.email.trim().toLowerCase() }).lean();
    if (!user) throw new UnauthorizedException('Unknown demo account. Try manny@demo.test, priya@demo.test or staff@demo.test.');
    const customerId = user.customerId ? String(user.customerId) : undefined;
    const token = this.tokens.sign({ sub: String(user._id), role: user.role, customerId });
    if (customerId) void this.activity.record(customerId, 'SIGNED_IN', 'Signed in to the app');
    return {
      token,
      user: {
        id: String(user._id),
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        customerId,
      },
    };
  }
}
