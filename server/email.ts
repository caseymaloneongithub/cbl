// Email service using Resend integration
import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {
    apiKey: connectionSettings.settings.api_key, 
    fromEmail: connectionSettings.settings.from_email
  };
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const result = await client.emails.send({
      from: fromEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    if (result.error) {
      console.error('Resend error:', result.error);
      return { success: false, error: result.error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Email send error:', error);
    return { success: false, error: error.message };
  }
}

export async function sendPasswordResetEmail(
  to: string, 
  firstName: string, 
  resetToken: string,
  appUrl: string
): Promise<{ success: boolean; error?: string }> {
  const resetLink = `${appUrl}/reset-password?token=${resetToken}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset - Strat League</title>
</head>
<body style="font-family: 'Roboto', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1a5f2a 0%, #2d8f4a 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Strat League Auction</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: #1a5f2a; margin-top: 0;">Password Reset Request</h2>
    
    <p>Hi ${firstName},</p>
    
    <p>We received a request to reset your password for your Strat League account. Click the button below to set a new password:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetLink}" style="background-color: #1a5f2a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
    </div>
    
    <p style="color: #666; font-size: 14px;">This link will expire in 1 hour for security reasons.</p>
    
    <p style="color: #666; font-size: 14px;">If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    
    <p style="color: #999; font-size: 12px; text-align: center;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${resetLink}" style="color: #1a5f2a; word-break: break-all;">${resetLink}</a>
    </p>
  </div>
</body>
</html>
  `;

  const text = `
Password Reset Request - Strat League

Hi ${firstName},

We received a request to reset your password for your Strat League account.

Click the following link to reset your password:
${resetLink}

This link will expire in 1 hour for security reasons.

If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
  `;

  return sendEmail({
    to,
    subject: 'Password Reset - Strat League Auction',
    html,
    text,
  });
}

export async function sendNewUserCredentialsEmail(
  to: string,
  firstName: string,
  temporaryPassword: string,
  appUrl: string
): Promise<{ success: boolean; error?: string }> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Strat League</title>
</head>
<body style="font-family: 'Roboto', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1a5f2a 0%, #2d8f4a 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Strat League Auction</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: #1a5f2a; margin-top: 0;">Welcome to Strat League!</h2>
    
    <p>Hi ${firstName},</p>
    
    <p>Your account has been created for the Strat League Auction platform. Here are your login credentials:</p>
    
    <div style="background: white; border: 1px solid #ddd; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${to}</p>
      <p style="margin: 0;"><strong>Temporary Password:</strong> <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">${temporaryPassword}</code></p>
    </div>
    
    <p style="color: #d9534f; font-weight: bold;">You will be required to change your password when you first log in.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${appUrl}" style="background-color: #1a5f2a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Login Now</a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    
    <p style="color: #999; font-size: 12px; text-align: center;">
      If you have any questions, please contact your league commissioner.
    </p>
  </div>
</body>
</html>
  `;

  const text = `
Welcome to Strat League!

Hi ${firstName},

Your account has been created for the Strat League Auction platform. Here are your login credentials:

Email: ${to}
Temporary Password: ${temporaryPassword}

You will be required to change your password when you first log in.

Login at: ${appUrl}

If you have any questions, please contact your league commissioner.
  `;

  return sendEmail({
    to,
    subject: 'Welcome to Strat League Auction - Your Login Credentials',
    html,
    text,
  });
}
