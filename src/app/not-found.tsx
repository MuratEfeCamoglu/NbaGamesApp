import type { Metadata } from "next";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <section className="screen" aria-labelledby="nf-title">
      <div className="container">
        <div className="not-found">
          <span className="not-found__code" aria-hidden="true">
            404
          </span>
          <h1 className="t-display t-3xl" id="nf-title">
            Air ball.
          </h1>
          <p className="t-muted">
            This page isn&apos;t on the court. It may have moved, or the link is wrong.
          </p>
          <div className="row">
            <Button href="/" icon="home">
              Back to home
            </Button>
            <Button href="/games" variant="secondary">
              Browse games
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
