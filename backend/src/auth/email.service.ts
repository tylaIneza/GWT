import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger('OTP');
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendVerificationOtp(email: string, name: string, otp: string) {
    if (!otp) return; // auto-verified flow, no OTP needed
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    this.logger.log(`OTP for ${email}: ${otp}`);
    try {
      await this.transporter.sendMail({
        from: `"DevixCode" <${from}>`,
        to: email,
        subject: 'Verify your DevixCode account',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;color:#e2e8f0;border-radius:16px">
            <div style="text-align:center;margin-bottom:24px">
              <div style="display:inline-flex;align-items:center;gap:8px">
                <div style="width:40px;height:40px;background:linear-gradient(135deg,#22c55e,#15803d);border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:20px;color:white">C</div>
                <span style="font-size:20px;font-weight:700;color:white">DevixCode</span>
              </div>
            </div>
            <h2 style="text-align:center;color:white;margin:0 0 8px">Welcome, ${name}!</h2>
            <p style="text-align:center;color:#94a3b8;margin:0 0 32px">Use the code below to verify your email address.</p>
            <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
              <div style="font-size:40px;font-weight:900;letter-spacing:12px;color:#22c55e;font-family:monospace">${otp}</div>
              <p style="color:#64748b;font-size:13px;margin:12px 0 0">Expires in 10 minutes</p>
            </div>
            <p style="color:#64748b;font-size:12px;text-align:center">If you didn't create a DevixCode account, ignore this email.</p>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error(`Failed to send verification email to ${email}`, err);
    }
  }

  async sendPasswordResetOtp(email: string, otp: string) {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    this.logger.log(`Password reset OTP for ${email}: ${otp}`);
    try {
      await this.transporter.sendMail({
        from: `"DevixCode" <${from}>`,
        to: email,
        subject: 'Reset your DevixCode password',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;color:#e2e8f0;border-radius:16px">
            <div style="text-align:center;margin-bottom:24px">
              <div style="display:inline-flex;align-items:center;gap:8px">
                <div style="width:40px;height:40px;background:linear-gradient(135deg,#22c55e,#15803d);border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:20px;color:white">C</div>
                <span style="font-size:20px;font-weight:700;color:white">DevixCode</span>
              </div>
            </div>
            <h2 style="text-align:center;color:white;margin:0 0 8px">Reset your password</h2>
            <p style="text-align:center;color:#94a3b8;margin:0 0 32px">Use the code below to reset your DevixCode password.</p>
            <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
              <div style="font-size:40px;font-weight:900;letter-spacing:12px;color:#f59e0b;font-family:monospace">${otp}</div>
              <p style="color:#64748b;font-size:13px;margin:12px 0 0">Expires in 10 minutes</p>
            </div>
            <p style="color:#64748b;font-size:12px;text-align:center">If you didn't request a password reset, ignore this email.</p>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error(`Failed to send password reset email to ${email}`, err);
    }
  }
}
