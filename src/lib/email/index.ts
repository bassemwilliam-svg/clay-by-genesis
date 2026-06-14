import "server-only";
import { env } from "@/lib/env";
import type { Mailer } from "./types";
import { ResendMailer } from "./resend";

export type { Mailer, EmailMessage, SendResult } from "./types";

// `null` is a real, cached value here (mailer unconfigured); `undefined` means
// "not yet resolved". This lets callers degrade gracefully without re-checking.
let instance: Mailer | null | undefined;

/** Factory: returns a configured Mailer, or null when no provider key is set. */
export function getMailer(): Mailer | null {
  if (instance === undefined) {
    instance = env.RESEND_API_KEY ? new ResendMailer() : null;
  }
  return instance;
}
