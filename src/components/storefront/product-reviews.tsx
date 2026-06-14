import { getProductReviews } from "@/lib/reviews/queries";
import { StarRating } from "./star-rating";
import { ReviewComposer } from "./review-composer";

/*
 * Reviews section for the product page. Server-rendered (cached with the ISR
 * page) for the public list + average; the personalized form is a client island
 * (ReviewComposer) that resolves ownership at request time.
 */

const dateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export async function ProductReviews({ productId }: { productId: string }) {
  const { average, count, reviews } = await getProductReviews(productId);

  return (
    <section className="mt-14">
      <span className="mono-label">Field reports</span>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Reviews</h2>
        {count > 0 ? (
          <div className="flex items-center gap-2">
            <StarRating value={average} size={18} />
            <span className="font-mono text-sm text-muted-foreground">
              {average.toFixed(1)} · {count}{" "}
              {count === 1 ? "review" : "reviews"}
            </span>
          </div>
        ) : (
          <span className="font-mono text-sm text-muted-foreground">
            No reviews yet
          </span>
        )}
      </div>

      <ReviewComposer productId={productId} />

      {reviews.length > 0 ? (
        <ul className="mt-6 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2">
          {reviews.map((r) => (
            <li key={r.id} className="bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <StarRating value={r.rating} size={14} />
                <span className="font-mono text-xs text-muted-foreground">
                  {dateFmt.format(r.createdAt)}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium">{r.authorName}</p>
              {r.body ? (
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                  {r.body}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
