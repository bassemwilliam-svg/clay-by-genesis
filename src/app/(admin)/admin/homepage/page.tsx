import { HomepageEditor } from "@/components/admin/homepage-editor";
import { getHomeVideo, listAllHomeSlides } from "@/lib/homepage/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Homepage · Admin · Clay" };

export default async function AdminHomepagePage() {
  const [video, slides] = await Promise.all([
    getHomeVideo(),
    listAllHomeSlides(),
  ]);

  return (
    <section className="mx-auto max-w-5xl px-6 py-12 md:px-10">
      <h1 className="text-3xl font-semibold tracking-tight">Homepage content</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Control the marketing homepage: the hero carousel backgrounds and the
        full-width video separator. Changes go live on the next page load.
      </p>
      <div className="mt-10">
        <HomepageEditor
          video={video}
          slides={slides}
          usingDefaultSlides={slides.length === 0}
        />
      </div>
    </section>
  );
}
