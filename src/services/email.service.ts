import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface InvitationEmailData {
  recipientEmail: string;
  inviterName: string;
  organizationName: string;
  role: string;
  inviteToken: string;
  expiresAt: Date;
}

interface SyncNotificationData {
  recipientEmail: string;
  integrationName: string;
  status: 'completed' | 'failed';
  syncedAt: Date;
  recordsProcessed?: number;
  errorMessage?: string;
}

interface ValidationErrorData {
  recipientEmail: string;
  fileName: string;
  totalRows: number;
  errorCount: number;
  errors: Array<{ row: number; field: string; message: string }>;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured = false;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpPort) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort, 10),
        secure: parseInt(smtpPort, 10) === 465,
        auth: smtpUser && smtpPass ? {
          user: smtpUser,
          pass: smtpPass,
        } : undefined,
      });
      this.isConfigured = true;
      logger.info('Email service configured with SMTP');
    } else {
      logger.info('Email service running in development mode (logging only)');
    }
  }

  private async send(options: EmailOptions): Promise<boolean> {
    const fromAddress = process.env.EMAIL_FROM || 'noreply@synclinqs.com';

    if (!this.isConfigured || !this.transporter) {
      // Development mode - log email instead of sending
      logger.info('Email (dev mode):', {
        to: options.to,
        subject: options.subject,
        preview: options.text?.substring(0, 200) || options.html.substring(0, 200),
      });
      console.log('\n========== EMAIL ===========');
      console.log(`To: ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      console.log('----------------------------');
      console.log(options.text || options.html);
      console.log('============================\n');
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      logger.info('Email sent', { to: options.to, subject: options.subject });
      return true;
    } catch (error) {
      logger.error('Failed to send email', { error: String(error), to: options.to });
      return false;
    }
  }

  async sendInvitation(data: InvitationEmailData): Promise<boolean> {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const acceptUrl = `${appUrl}/accept-invite?token=${data.inviteToken}`;
    const expiresFormatted = data.expiresAt.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9fafb; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>You're Invited to SyncLinqs</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p><strong>${data.inviterName}</strong> has invited you to join <strong>${data.organizationName}</strong> on SyncLinqs as a <strong>${data.role}</strong>.</p>
      <p>SyncLinqs helps organizations manage 401(k) contributions and integrate with payroll systems securely.</p>
      <p style="text-align: center;">
        <a href="${acceptUrl}" class="button">Accept Invitation</a>
      </p>
      <p>Or copy this link: <code>${acceptUrl}</code></p>
      <p><em>This invitation expires on ${expiresFormatted}.</em></p>
    </div>
    <div class="footer">
      <p>SyncLinqs - Secure 401(k) Integration Platform</p>
    </div>
  </div>
</body>
</html>
`;

    const text = `
You're Invited to SyncLinqs

${data.inviterName} has invited you to join ${data.organizationName} on SyncLinqs as a ${data.role}.

Accept your invitation: ${acceptUrl}

This invitation expires on ${expiresFormatted}.

---
SyncLinqs - Secure 401(k) Integration Platform
`;

    return this.send({
      to: data.recipientEmail,
      subject: `You're invited to join ${data.organizationName} on SyncLinqs`,
      html,
      text,
    });
  }

  async sendSyncNotification(data: SyncNotificationData): Promise<boolean> {
    const isSuccess = data.status === 'completed';
    const syncTimeFormatted = data.syncedAt.toLocaleString('en-US');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${isSuccess ? '#059669' : '#dc2626'}; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9fafb; }
    .status { font-size: 24px; font-weight: bold; color: ${isSuccess ? '#059669' : '#dc2626'}; }
    .details { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
    .error { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 6px; color: #991b1b; }
    .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Integration Sync ${isSuccess ? 'Completed' : 'Failed'}</h1>
    </div>
    <div class="content">
      <p class="status">${isSuccess ? '✓ Success' : '✗ Failed'}</p>
      <div class="details">
        <p><strong>Integration:</strong> ${data.integrationName}</p>
        <p><strong>Time:</strong> ${syncTimeFormatted}</p>
        ${data.recordsProcessed !== undefined ? `<p><strong>Records Processed:</strong> ${data.recordsProcessed}</p>` : ''}
      </div>
      ${data.errorMessage ? `<div class="error"><strong>Error:</strong> ${data.errorMessage}</div>` : ''}
    </div>
    <div class="footer">
      <p>SyncLinqs - Secure 401(k) Integration Platform</p>
    </div>
  </div>
</body>
</html>
`;

    const text = `
Integration Sync ${isSuccess ? 'Completed' : 'Failed'}

Integration: ${data.integrationName}
Status: ${isSuccess ? 'Success' : 'Failed'}
Time: ${syncTimeFormatted}
${data.recordsProcessed !== undefined ? `Records Processed: ${data.recordsProcessed}` : ''}
${data.errorMessage ? `Error: ${data.errorMessage}` : ''}

---
SyncLinqs - Secure 401(k) Integration Platform
`;

    return this.send({
      to: data.recipientEmail,
      subject: `Sync ${isSuccess ? 'Completed' : 'Failed'}: ${data.integrationName}`,
      html,
      text,
    });
  }

  async sendValidationErrors(data: ValidationErrorData): Promise<boolean> {
    const errorRows = data.errors.slice(0, 10); // Limit to first 10 errors in email
    const hasMore = data.errors.length > 10;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f59e0b; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9fafb; }
    .summary { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
    .error-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    .error-table th, .error-table td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
    .error-table th { background: #f3f4f6; }
    .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Batch Upload Validation Errors</h1>
    </div>
    <div class="content">
      <div class="summary">
        <p><strong>File:</strong> ${data.fileName}</p>
        <p><strong>Total Rows:</strong> ${data.totalRows}</p>
        <p><strong>Errors Found:</strong> ${data.errorCount}</p>
      </div>
      <table class="error-table">
        <thead>
          <tr>
            <th>Row</th>
            <th>Field</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          ${errorRows.map(e => `
            <tr>
              <td>${e.row}</td>
              <td>${e.field}</td>
              <td>${e.message}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${hasMore ? `<p><em>...and ${data.errors.length - 10} more errors. Please review the full report in the application.</em></p>` : ''}
    </div>
    <div class="footer">
      <p>SyncLinqs - Secure 401(k) Integration Platform</p>
    </div>
  </div>
</body>
</html>
`;

    const text = `
Batch Upload Validation Errors

File: ${data.fileName}
Total Rows: ${data.totalRows}
Errors Found: ${data.errorCount}

Errors:
${errorRows.map(e => `Row ${e.row}, ${e.field}: ${e.message}`).join('\n')}
${hasMore ? `\n...and ${data.errors.length - 10} more errors.` : ''}

---
SyncLinqs - Secure 401(k) Integration Platform
`;

    return this.send({
      to: data.recipientEmail,
      subject: `Validation Errors in ${data.fileName}`,
      html,
      text,
    });
  }
}
