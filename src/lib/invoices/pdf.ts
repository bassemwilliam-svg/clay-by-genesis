import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  INVOICE_SELLER,
  formatInvoiceNumber,
  type InvoiceSnapshot,
} from "./snapshot";

/*
 * Renders an invoice PDF from a frozen snapshot using pdf-lib (pure JS, no
 * native deps, no headless browser). Generated on demand from the snapshot
 * rather than baked at payment time, so it never depends on object storage and
 * always reflects the immutable record. Returns raw PDF bytes.
 */

// US Letter, in points.
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 56;

const INK = rgb(0.06, 0.07, 0.09);
const MUTED = rgb(0.45, 0.47, 0.5);
const RULE = rgb(0.85, 0.86, 0.88);
const ACCENT = rgb(0.02, 0.45, 0.55);

/** Font-safe money: a currency code prefix avoids missing glyphs in Helvetica. */
function money(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

/** Truncate text with an ellipsis so it fits within `maxWidth` at `size`. */
function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && font.widthOfTextAtSize(`${s}…`, size) > maxWidth) {
    s = s.slice(0, -1);
  }
  return `${s.trimEnd()}…`;
}

export async function renderInvoicePdf(snap: InvoiceSnapshot): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${formatInvoiceNumber(snap.invoiceNumber)} · ${INVOICE_SELLER.name}`);
  doc.setProducer("Clay by Genesis");
  doc.setCreator("Clay by Genesis");

  const page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const left = MARGIN;
  const right = PAGE_W - MARGIN;
  let y = PAGE_H - MARGIN;

  const text = (
    s: string,
    x: number,
    yy: number,
    opts: { font?: PDFFont; size?: number; color?: typeof INK } = {},
  ) => {
    page.drawText(s, {
      x,
      y: yy,
      font: opts.font ?? reg,
      size: opts.size ?? 10,
      color: opts.color ?? INK,
    });
  };

  const textRight = (
    s: string,
    xRight: number,
    yy: number,
    opts: { font?: PDFFont; size?: number; color?: typeof INK } = {},
  ) => {
    const font = opts.font ?? reg;
    const size = opts.size ?? 10;
    text(s, xRight - font.widthOfTextAtSize(s, size), yy, opts);
  };

  // --- Header: seller (left) / INVOICE meta (right) ---
  text(INVOICE_SELLER.name, left, y, { font: bold, size: 20 });
  textRight("INVOICE", right, y, { font: bold, size: 20, color: ACCENT });
  y -= 16;
  text(INVOICE_SELLER.tagline, left, y, { size: 9, color: MUTED });
  textRight(formatInvoiceNumber(snap.invoiceNumber), right, y, {
    size: 10,
    color: MUTED,
  });
  y -= 14;
  const issued = new Date(snap.issuedAt);
  const issuedLabel = Number.isNaN(issued.getTime())
    ? snap.issuedAt
    : issued.toISOString().slice(0, 10);
  textRight(`Issued ${issuedLabel}`, right, y, { size: 10, color: MUTED });

  y -= 30;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: RULE });
  y -= 28;

  // --- Bill to (left) / Order meta (right) ---
  const metaTop = y;
  text("BILLED TO", left, y, { font: bold, size: 8, color: MUTED });
  y -= 15;
  text(snap.buyer.name ?? snap.buyer.email ?? "Customer", left, y, { size: 11 });
  if (snap.buyer.email) {
    y -= 13;
    text(snap.buyer.email, left, y, { size: 10, color: MUTED });
  }

  let ry = metaTop;
  const metaRight = (label: string, value: string) => {
    text(label, right - 230, ry, { font: bold, size: 8, color: MUTED });
    textRight(fit(value, reg, 9, 200), right, ry, { size: 9 });
    ry -= 14;
  };
  metaRight("ORDER", snap.order.id);
  metaRight("PROVIDER", snap.order.provider);
  if (snap.order.providerPaymentId) {
    metaRight("PAYMENT", snap.order.providerPaymentId);
  }

  y = Math.min(y, ry) - 30;

  // --- Line-item table ---
  const colQtyRight = right - 130;
  const colAmtRight = right;
  text("ITEM", left, y, { font: bold, size: 8, color: MUTED });
  textRight("QTY", colQtyRight, y, { font: bold, size: 8, color: MUTED });
  textRight("AMOUNT", colAmtRight, y, { font: bold, size: 8, color: MUTED });
  y -= 10;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: RULE });
  y -= 20;

  for (const item of snap.items) {
    text(fit(item.title, reg, 10, colQtyRight - left - 16), left, y, { size: 10 });
    textRight(String(item.quantity), colQtyRight, y, { size: 10, color: MUTED });
    textRight(money(item.priceCents * item.quantity, snap.currency), colAmtRight, y, {
      size: 10,
    });
    y -= 20;
    if (y < MARGIN + 120) {
      // Defensive: a very long order would overflow; keep totals on the page.
      break;
    }
  }

  y -= 4;
  page.drawLine({ start: { x: colQtyRight - 40, y }, end: { x: right, y }, thickness: 1, color: RULE });
  y -= 22;

  // --- Totals ---
  text("Subtotal", colQtyRight - 40, y, { size: 10, color: MUTED });
  textRight(money(snap.subtotalCents, snap.currency), colAmtRight, y, { size: 10 });
  y -= 22;
  text("Total", colQtyRight - 40, y, { font: bold, size: 12 });
  textRight(money(snap.totalCents, snap.currency), colAmtRight, y, {
    font: bold,
    size: 12,
  });

  // --- Footer ---
  const footY = MARGIN + 6;
  page.drawLine({
    start: { x: left, y: footY + 26 },
    end: { x: right, y: footY + 26 },
    thickness: 1,
    color: RULE,
  });
  text(
    "Thank you for building with Clay. This invoice was generated automatically on payment.",
    left,
    footY + 10,
    { size: 8, color: MUTED },
  );
  text("Digital goods. All sales final unless otherwise stated by license.", left, footY - 2, {
    size: 8,
    color: MUTED,
  });

  return doc.save();
}
