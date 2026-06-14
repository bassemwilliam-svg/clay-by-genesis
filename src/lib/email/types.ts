/*
 * Email port. Nothing outside this folder talks to Resend directly. The
 * concrete mailer is chosen by env via the factory in ./index; until a key is
 * provisioned, getMailer() returns null and senders no-op (logged).
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendResult {
  id?: string;
}

export interface Mailer {
  readonly name: string;
  send(message: EmailMessage): Promise<SendResult>;
}
