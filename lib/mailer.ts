import nodemailer from "nodemailer";

export class MailerError extends Error {}

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const appPassword = process.env.GMAIL_APP_PASSWORD;

  if (!user || !appPassword) {
    throw new MailerError(
      "GMAIL_USER / GMAIL_APP_PASSWORD environment variable is not defined"
    );
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass: appPassword },
    });
  }

  return cachedTransporter;
}

export async function sendMail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const transporter = getTransporter();
  const fromName = process.env.MAIL_FROM_NAME ?? "JARIS";
  const fromAddress = process.env.GMAIL_USER;

  await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
}

/** Fire-and-forget wrapper: logs failures instead of throwing, so a mail
 * outage never breaks the request that triggered it (account creation,
 * claim status change, etc.). */
export async function sendMailSafe(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  try {
    await sendMail(params);
    return true;
  } catch (error) {
    console.error("sendMailSafe failed:", error);
    return false;
  }
}
