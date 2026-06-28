import type { HomeVideo } from "@/lib/homepage/queries";

/*
 * Full-width video separator band above the featured courses. When an admin has
 * set a video URL it plays muted/looping as the background; otherwise the poster
 * image stands in. Plain HTML <video> (no client JS needed) keeps it cheap and
 * SSR-friendly. Heading and subtext are admin-editable.
 */
export function HomeVideoSeparator({ video }: { video: HomeVideo }) {
  return (
    <section className="relative isolate w-full overflow-hidden border-y border-border">
      <div className="absolute inset-0 -z-10">
        {video.url ? (
          <video
            className="h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            poster={video.poster}
          >
            <source src={video.url} />
          </video>
        ) : (
          <div
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${video.poster})` }}
          />
        )}
        <div className="absolute inset-0 bg-background/70" />
        <div className="bp-grid absolute inset-0 opacity-20" />
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-6 py-24 text-center md:px-10 md:py-32">
        <span className="mono-label">{"// from clay to shipped"}</span>
        <h2 className="mx-auto mt-3 max-w-3xl text-balance text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
          {video.heading}
        </h2>
        {video.subtext ? (
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            {video.subtext}
          </p>
        ) : null}
      </div>
    </section>
  );
}
