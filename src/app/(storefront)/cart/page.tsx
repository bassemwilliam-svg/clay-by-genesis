import { getCart } from "@/lib/cart/queries";
import { CartView } from "@/components/cart/cart-view";

// Reads the cart cookie, so it's request-dynamic (never ISR-cached).
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const cart = await getCart();

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 md:px-10">
      <span className="mono-label">Checkout staging</span>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Your cart</h1>
      <CartView initial={cart} />
    </div>
  );
}
