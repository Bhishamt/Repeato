const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export type Mail = { to: string; subject: string; text: string };

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

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text }),
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
