/*
 * Invoice snapshot: a frozen copy of the buyer + line items + totals taken at
 * the moment the order is paid. It is the single source of truth for the
 * invoice, so the PDF (and any future re-render) can be reproduced exactly even
 * if the product titles, prices, or the buyer's profile change later.
 *
 * Pure module (no server-only): the pipeline writes it, the PDF generator and
 * the account UI read it.
 */

export interface InvoiceLineItem {
  title: string;
  priceCents: number;
  quantity: number;
}

export interface InvoiceParty {
  name: string | null;
  email: string | null;
}

export interface InvoiceSnapshot {
  /** Sequential, human-facing invoice number (also stored as Invoice.number). */
  invoiceNumber: number;
  /** ISO timestamp of issuance. */
  issuedAt: string;
  currency: string;
  subtotalCents: number;
  totalCents: number;
  order: {
    id: string;
    provider: string;
    providerPaymentId: string | null;
  };
  buyer: InvoiceParty;
  seller: {
    name: string;
    tagline: string;
  };
  items: InvoiceLineItem[];
}

/** The studio issuing the invoice. Static for now; could move to config later. */
export const INVOICE_SELLER = {
  name: "Clay by Genesis",
  tagline: "Procedural worlds, forged to be yours.",
} as const;

/** Zero-padded display form, e.g. 42 -> "INV-000042". */
export function formatInvoiceNumber(n: number): string {
  return `INV-${String(n).padStart(6, "0")}`;
}

/**
 * Narrow an untyped Json column back to InvoiceSnapshot. Defensive: the column
 * is `Json`, so we validate the shape before trusting it (e.g. an older row).
 */
export function isInvoiceSnapshot(value: unknown): value is InvoiceSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.invoiceNumber === "number" &&
    typeof v.issuedAt === "string" &&
    typeof v.currency === "string" &&
    typeof v.totalCents === "number" &&
    Array.isArray(v.items)
  );
}
