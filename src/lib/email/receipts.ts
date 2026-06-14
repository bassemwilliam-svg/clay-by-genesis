import "server-only";
import { getMailer } from "./index";
import {
  INVOICE_SELLER,
  formatInvoiceNumber,
  type InvoiceSnapshot,
} from "@/lib/invoices/snapshot";
import { getBaseUrl } from "@/lib/url";

/*
 * Transactional receipt for a paid order. Best-effort: never throws to the
 * caller (a failed email must not roll back a granted entitlement) and no-ops
 * with a log line when the mailer isn't provisioned yet.
 */

function money(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function receiptHtml(snap: InvoiceSnapshot, ordersUrl: string): string {
  const rows = snap.items
    .map(
      (it) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #ececef;color:#0f1115;">${escapeHtml(it.title)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #ececef;color:#6b7280;text-align:right;">${it.quantity}</td>
          <td style="padding:8px 0;border-bottom:1px solid #ececef;color:#0f1115;text-align:right;white-space:nowrap;">${money(it.priceCents * it.quantity, snap.currency)}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5f6f8;font-family:Helvetica,Arial,sans-serif;color:#0f1115;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
      <div style="font-size:20px;font-weight:700;">${escapeHtml(INVOICE_SELLER.name)}</div>
      <div style="font-size:12px;color:#6b7280;margin-top:2px;">${escapeHtml(INVOICE_SELLER.tagline)}</div>

      <div style="margin-top:28px;background:#ffffff;border:1px solid #ececef;border-radius:12px;padding:24px;">
        <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Receipt ${escapeHtml(formatInvoiceNumber(snap.invoiceNumber))}</div>
        <div style="font-size:17px;font-weight:600;margin-top:6px;">Thank you for your order</div>
        <div style="font-size:13px;color:#6b7280;margin-top:4px;">Your purchases are now in your library.</div>

        <table style="width:100%;border-collapse:collapse;margin-top:20px;font-size:13px;">
          <thead>
            <tr>
              <th style="text-align:left;font-size:11px;color:#6b7280;font-weight:600;padding-bottom:6px;">Item</th>
              <th style="text-align:right;font-size:11px;color:#6b7280;font-weight:600;padding-bottom:6px;">Qty</th>
              <th style="text-align:right;font-size:11px;color:#6b7280;font-weight:600;padding-bottom:6px;">Amount</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div style="margin-top:16px;display:flex;justify-content:space-between;font-size:15px;font-weight:700;">
          <span>Total</span>
          <span>${money(snap.totalCents, snap.currency)}</span>
        </div>

        <a href="${ordersUrl}" style="display:inline-block;margin-top:24px;background:#0a7387;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:11px 20px;border-radius:8px;">View orders &amp; invoice</a>
      </div>

      <div style="font-size:11px;color:#9aa0a6;margin-top:20px;line-height:1.5;">
        Order ${escapeHtml(snap.order.id)} &middot; ${escapeHtml(snap.order.provider)}<br/>
        Digital goods. All sales final unless otherwise stated by license.
      </div>
    </div>
  </body>
</html>`;
}

export async function sendOrderReceipt(
  snap: InvoiceSnapshot,
): Promise<{ sent: boolean }> {
  if (!snap.buyer.email) {
    console.warn(`[receipts] order ${snap.order.id} has no buyer email; skipping`);
    return { sent: false };
  }

  const mailer = getMailer();
  if (!mailer) {
    console.info(
      `[receipts] mailer not configured; would email ${snap.buyer.email} ${formatInvoiceNumber(snap.invoiceNumber)}`,
    );
    return { sent: false };
  }

  try {
    const baseUrl = await getBaseUrl();
    await mailer.send({
      to: snap.buyer.email,
      subject: `Your Clay receipt · ${formatInvoiceNumber(snap.invoiceNumber)}`,
      html: receiptHtml(snap, `${baseUrl}/orders`),
    });
    return { sent: true };
  } catch (e) {
    console.error(`[receipts] send failed for order ${snap.order.id}`, e);
    return { sent: false };
  }
}
