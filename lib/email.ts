const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export type Mail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/** Escapes special characters to prevent HTML injection in email markup. */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/*
 * Sends through Resend when RESEND_API_KEY and MAIL_FROM are configured.
 * Without them the message is written to the server log and reported as not
 * delivered, so local development and tests never email a real person.
 */
export async function sendMail(mail: Mail): Promise<{ delivered: boolean }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) {
    console.info(`[email:dev] to=${mail.to} subject=${mail.subject}\n${mail.text}`);
    return { delivered: false };
  }

  const payload: Record<string, unknown> = {
    from,
    to: [mail.to],
    subject: mail.subject,
    text: mail.text,
  };
  if (mail.html) {
    payload.html = mail.html;
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`email provider rejected the message (${response.status}) ${detail.slice(0, 200)}`);
  }
  return { delivered: true };
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

/** Renders responsive, branded HTML email markup with consistent styling. */
export function renderEmailLayout(params: {
  title: string;
  heading: string;
  bodyHtml: string;
  buttonText?: string;
  buttonUrl?: string;
  footerText?: string;
}): string {
  const { title, heading, bodyHtml, buttonText, buttonUrl, footerText } = params;
  const buttonMarkup =
    buttonText && buttonUrl
      ? `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
          <tr>
            <td align="center" style="border-radius: 6px; background-color: #0f172a;">
              <a href="${escapeHtml(buttonUrl)}" target="_blank" style="display: inline-block; padding: 12px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px;">
                ${escapeHtml(buttonText)}
              </a>
            </td>
          </tr>
        </table>`
      : "";

  const footerMarkup = footerText
    ? `<p style="margin: 16px 0 0; font-size: 12px; color: #64748b; line-height: 1.5;">${escapeHtml(footerText)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; padding: 32px;">
          <tr>
            <td>
              <div style="margin-bottom: 24px; font-size: 18px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;">
                Repeato
              </div>
              <h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #0f172a; line-height: 1.3;">
                ${escapeHtml(heading)}
              </h1>
              <div style="font-size: 14px; line-height: 1.6; color: #334155;">
                ${bodyHtml}
              </div>
              ${buttonMarkup}
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 20px;" />
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.4;">
                Repeato Loyalty SaaS &bull; Automated customer retention
              </p>
              ${footerMarkup}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Generates verification email payload with both plain-text and HTML versions. */
export function buildVerificationEmail(params: {
  to: string;
  name: string;
  token: string;
  appBaseUrl?: string;
}): Mail & { html: string } {
  const base = params.appBaseUrl ?? appUrl();
  const verifyUrl = `${base}/verify?token=${encodeURIComponent(params.token)}`;

  const text = `Hi ${params.name},\n\nConfirm your email address to finish setting up Repeato:\n${verifyUrl}\n\nThe link works once and expires in 24 hours. If you did not sign up for Repeato, you can safely ignore this email.`;

  const bodyHtml = `
    <p style="margin: 0 0 12px;">Hi ${escapeHtml(params.name)},</p>
    <p style="margin: 0 0 16px;">Confirm your email address to finish setting up your account and get started with Repeato.</p>
  `;

  const html = renderEmailLayout({
    title: "Confirm your Repeato email",
    heading: "Confirm your email address",
    bodyHtml,
    buttonText: "Confirm Email Address",
    buttonUrl: verifyUrl,
    footerText: "The link works once and expires in 24 hours. If you did not create an account, you can ignore this message.",
  });

  return {
    to: params.to,
    subject: "Confirm your Repeato email",
    text,
    html,
  };
}

/** Generates password reset email payload with single-use security token. */
export function buildPasswordResetEmail(params: {
  to: string;
  name: string;
  token: string;
  appBaseUrl?: string;
}): Mail & { html: string } {
  const base = params.appBaseUrl ?? appUrl();
  const resetUrl = `${base}/reset?token=${encodeURIComponent(params.token)}`;

  const text = `Hi ${params.name},\n\nUse this link to choose a new password:\n${resetUrl}\n\nThe link works once and expires in 60 minutes. If you did not ask for this, ignore the email.`;

  const bodyHtml = `
    <p style="margin: 0 0 12px;">Hi ${escapeHtml(params.name)},</p>
    <p style="margin: 0 0 16px;">We received a request to reset your password. Click the button below to choose a new one:</p>
  `;

  const html = renderEmailLayout({
    title: "Reset your Repeato password",
    heading: "Reset your password",
    bodyHtml,
    buttonText: "Reset Password",
    buttonUrl: resetUrl,
    footerText: "This link works once and expires in 60 minutes. If you did not request a password reset, no action is required.",
  });

  return {
    to: params.to,
    subject: "Reset your Repeato password",
    text,
    html,
  };
}

/** Generates notification email when a loyalty reward is unlocked. */
export function buildRewardUnlockedEmail(params: {
  to: string;
  customerName: string;
  businessName: string;
  rewardTitle: string;
  voucherCode?: string;
  appBaseUrl?: string;
}): Mail & { html: string } {
  const base = params.appBaseUrl ?? appUrl();
  const appLink = `${base}/app`;

  const voucherText = params.voucherCode ? ` Your voucher code is: ${params.voucherCode}.` : "";
  const text = `Hi ${params.customerName},\n\nGreat news! You have unlocked a new reward at ${params.businessName}: "${params.rewardTitle}".${voucherText}\n\nView and redeem your rewards in the app: ${appLink}`;

  const voucherHtml = params.voucherCode
    ? `<div style="background-color: #f1f5f9; border: 1px dashed #94a3b8; border-radius: 6px; padding: 12px; margin: 16px 0; text-align: center;">
         <span style="font-size: 12px; color: #64748b; display: block; text-transform: uppercase; letter-spacing: 0.05em;">Voucher Code</span>
         <strong style="font-size: 18px; color: #0f172a; font-family: monospace;">${escapeHtml(params.voucherCode)}</strong>
       </div>`
    : "";

  const bodyHtml = `
    <p style="margin: 0 0 12px;">Hi ${escapeHtml(params.customerName)},</p>
    <p style="margin: 0 0 12px;">Great news! You have unlocked a reward at <strong>${escapeHtml(params.businessName)}</strong>:</p>
    <p style="font-size: 16px; font-weight: 600; color: #0f172a; margin: 8px 0;">${escapeHtml(params.rewardTitle)}</p>
    ${voucherHtml}
  `;

  const html = renderEmailLayout({
    title: `Reward unlocked at ${params.businessName}`,
    heading: "You unlocked a reward!",
    bodyHtml,
    buttonText: "Open Repeato App",
    buttonUrl: appLink,
    footerText: "Show this voucher or your in-app pass to the staff to redeem your reward.",
  });

  return {
    to: params.to,
    subject: `You unlocked a reward at ${params.businessName}!`,
    text,
    html,
  };
}

/** Generates notification email when customer points balance changes. */
export function buildPointsUpdateEmail(params: {
  to: string;
  customerName: string;
  businessName: string;
  delta: number;
  newBalance: number;
  appBaseUrl?: string;
}): Mail & { html: string } {
  const base = params.appBaseUrl ?? appUrl();
  const appLink = `${base}/app`;
  const formattedDelta = params.delta >= 0 ? `+${params.delta}` : `${params.delta}`;

  const text = `Hi ${params.customerName},\n\nYou earned ${formattedDelta} points at ${params.businessName}. Your total balance is now ${params.newBalance} points.\n\nCheck your progress and rewards: ${appLink}`;

  const bodyHtml = `
    <p style="margin: 0 0 12px;">Hi ${escapeHtml(params.customerName)},</p>
    <p style="margin: 0 0 16px;">You recently earned <strong>${escapeHtml(formattedDelta)} points</strong> at <strong>${escapeHtml(params.businessName)}</strong>.</p>
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; text-align: center; margin: 16px 0;">
      <span style="font-size: 12px; color: #64748b; display: block; text-transform: uppercase;">Current Balance</span>
      <span style="font-size: 24px; font-weight: 700; color: #0f172a;">${params.newBalance} pts</span>
    </div>
  `;

  const html = renderEmailLayout({
    title: `Points update from ${params.businessName}`,
    heading: "Points balance update",
    bodyHtml,
    buttonText: "View Rewards",
    buttonUrl: appLink,
  });

  return {
    to: params.to,
    subject: `Points update: ${formattedDelta} points at ${params.businessName}`,
    text,
    html,
  };
}
