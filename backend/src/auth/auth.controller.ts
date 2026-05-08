import { Controller, Post, Get, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { AuthService }  from './auth.service';
import { RegisterDto }  from './dto/register.dto';
import { LoginDto }     from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: any) {
    return this.auth.register(dto, req.ip, req.headers['user-agent']);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: any) {
    return this.auth.login(dto, req.ip, req.headers['user-agent']);
  }

  @Post('verify-email')
  @HttpCode(200)
  verifyEmail(@Body() body: { email: string; otp: string }, @Req() req: any) {
    return this.auth.verifyEmail(body.email, body.otp, req.ip, req.headers['user-agent']);
  }

  @Post('resend-otp')
  @HttpCode(200)
  resendOtp(@Body() body: { email: string }) {
    return this.auth.resendOtp(body.email);
  }

  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() body: { email: string }) {
    return this.auth.forgotPassword(body.email);
  }

  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() body: { email: string; otp: string; new_password: string }) {
    return this.auth.resetPassword(body.email, body.otp, body.new_password);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  logout(@Req() req: any) {
    const token = req.headers.authorization?.split(' ')[1];
    return this.auth.logout(req.user.id, token);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: any) {
    return this.auth.me(req.user.id);
  }
}
