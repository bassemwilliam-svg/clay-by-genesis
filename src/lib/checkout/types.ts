/*
 * Shared checkout types. Kept in a plain module (not the "use server" actions
 * file, which may only export async functions) so client components can import
 * the state shape for useActionState.
 */
export type CheckoutState = { error?: string };
