import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.meta.pageNotFoundTitle };
}

export default async function NotFound() {
  const { t } = await getT();
  return (
    <section className="screen" aria-labelledby="nf-title">
      <div className="container">
        <div className="not-found">
          <span className="not-found__code" aria-hidden="true">
            404
          </span>
          <h1 className="t-display t-3xl" id="nf-title">
            {t.notFound.title}
          </h1>
          <p className="t-muted">{t.notFound.description}</p>
          <div className="row">
            <Button href="/" icon="home">
              {t.notFound.back}
            </Button>
            <Button href="/games" variant="secondary">
              {t.notFound.browse}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
