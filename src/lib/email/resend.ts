import "server-only";
import { env } from "@/lib/env";
import type { EmailMessage, Mailer, SendResult } from "./types";

/*
 * Resend adapter over the REST API via fetch (no SDK dependency, same pattern
 * as the Voyage embedder). Only constructed when RESEND_API_KEY is set, so the
 * send path here always has a key.
 */
const DEFAULT_FROM = "Clay by Genesis <receipts@genesis.forge>";

export class ResendMailer implements Mailer {
  readonly name = "resend";

  async send(message: EmailMessage): Promise<SendResult> {
    const key = env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not configured");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM || DEFAULT_FROM,
        to: message.to,
        subject: message.subject,
        html: message.html,
        ...(message.text ? { text: message.text } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Resend send failed (${res.status}): ${detail.slice(0, 200)}`);
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { id: data.id };
  }
}
