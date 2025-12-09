// Email service using Resend
import { Resend } from 'resend';

// Use direct API key from environment
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY not configured');
  }
  
  // Default from email - can be customized once domain is verified
  const fromEmail = 'CBL Auctions <onboarding@resend.dev>';
  
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
    const { client, fromEmail } = getResendClient();
    
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
  <title>Password Reset - CBL Auctions</title>
</head>
<body style="font-family: 'Roboto', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1a5f2a 0%, #2d8f4a 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">CBL Auctions</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: #1a5f2a; margin-top: 0;">Password Reset Request</h2>
    
    <p>Hi ${firstName},</p>
    
    <p>We received a request to reset your password for your CBL Auctions account. Click the button below to set a new password:</p>
    
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
Password Reset Request - CBL Auctions

Hi ${firstName},

We received a request to reset your password for your CBL Auctions account.

Click the following link to reset your password:
${resetLink}

This link will expire in 1 hour for security reasons.

If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
  `;

  return sendEmail({
    to,
    subject: 'Password Reset - CBL Auctions',
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
  <title>Welcome to CBL Auctions</title>
</head>
<body style="font-family: 'Roboto', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1a5f2a 0%, #2d8f4a 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">CBL Auctions</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: #1a5f2a; margin-top: 0;">Welcome to CBL Auctions!</h2>
    
    <p>Hi ${firstName},</p>
    
    <p>Your account has been created for the CBL Auctions platform. Here are your login credentials:</p>
    
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
Welcome to CBL Auctions!

Hi ${firstName},

Your account has been created for the CBL Auctions platform. Here are your login credentials:

Email: ${to}
Temporary Password: ${temporaryPassword}

You will be required to change your password when you first log in.

Login at: ${appUrl}

If you have any questions, please contact your league commissioner.
  `;

  return sendEmail({
    to,
    subject: 'Welcome to CBL Auctions - Your Login Credentials',
    html,
    text,
  });
}

interface AuctionResult {
  playerName: string;
  team: string;
  auctionName: string;
  winnerName?: string;
  winnerTeam?: string;
  amount?: number;
  years?: number;
  noBids?: boolean;
}

export async function sendAuctionResultsSummaryEmail(
  to: string,
  adminName: string,
  results: AuctionResult[]
): Promise<{ success: boolean; error?: string }> {
  const withBids = results.filter(r => !r.noBids);
  const noBids = results.filter(r => r.noBids);
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const now = new Date();
  const easternTime = now.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  let withBidsHtml = '';
  if (withBids.length > 0) {
    withBidsHtml = `
      <h3 style="color: #1a5f2a; margin-top: 20px;">Players Won (${withBids.length})</h3>
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        <thead>
          <tr style="background: #f0f0f0;">
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Player</th>
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">MLB Team</th>
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Auction</th>
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Winner</th>
            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Contract</th>
          </tr>
        </thead>
        <tbody>
          ${withBids.map(r => `
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px;">${r.playerName}</td>
              <td style="padding: 10px;">${r.team}</td>
              <td style="padding: 10px; font-size: 12px; color: #666;">${r.auctionName}</td>
              <td style="padding: 10px;">${r.winnerName} (${r.winnerTeam})</td>
              <td style="padding: 10px; text-align: right; font-weight: bold;">${formatCurrency(r.amount || 0)} x ${r.years}yr</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  let noBidsHtml = '';
  if (noBids.length > 0) {
    noBidsHtml = `
      <h3 style="color: #d9534f; margin-top: 20px;">No Bids Received (${noBids.length})</h3>
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        <thead>
          <tr style="background: #f0f0f0;">
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Player</th>
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">MLB Team</th>
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Auction</th>
          </tr>
        </thead>
        <tbody>
          ${noBids.map(r => `
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px;">${r.playerName}</td>
              <td style="padding: 10px;">${r.team}</td>
              <td style="padding: 10px; font-size: 12px; color: #666;">${r.auctionName}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hourly Auction Results - CBL Auctions</title>
</head>
<body style="font-family: 'Roboto', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1a5f2a 0%, #2d8f4a 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">CBL Auctions</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Hourly Auction Results Summary</p>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
    <p>Hi ${adminName},</p>
    
    <p>Here are the auction results from the past hour (as of ${easternTime} ET):</p>
    
    <div style="background: white; border: 1px solid #ddd; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0;"><strong>Total Auctions Closed:</strong> ${results.length}</p>
      <p style="margin: 5px 0 0 0;"><strong>Won:</strong> ${withBids.length} | <strong>No Bids:</strong> ${noBids.length}</p>
    </div>

    ${withBidsHtml}
    ${noBidsHtml}
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    
    <p style="color: #999; font-size: 12px; text-align: center;">
      This is an automated hourly summary from CBL Auctions.
    </p>
  </div>
</body>
</html>
  `;

  const withBidsText = withBids.length > 0 
    ? `\nPlayers Won (${withBids.length}):\n` + withBids.map(r => 
        `- ${r.playerName} (${r.team}) - ${r.auctionName} - Won by ${r.winnerName} (${r.winnerTeam}) for ${formatCurrency(r.amount || 0)} x ${r.years}yr`
      ).join('\n')
    : '';
    
  const noBidsText = noBids.length > 0
    ? `\nNo Bids Received (${noBids.length}):\n` + noBids.map(r => 
        `- ${r.playerName} (${r.team}) - ${r.auctionName}`
      ).join('\n')
    : '';

  const text = `
Hourly Auction Results Summary - CBL Auctions

Hi ${adminName},

Here are the auction results from the past hour (as of ${easternTime} ET):

Total Auctions Closed: ${results.length}
Won: ${withBids.length} | No Bids: ${noBids.length}
${withBidsText}
${noBidsText}

This is an automated hourly summary from CBL Auctions.
  `;

  return sendEmail({
    to,
    subject: `CBL Auctions - Hourly Results Summary (${results.length} closed)`,
    html,
    text,
  });
}
