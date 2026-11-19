"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

/** Route error boundary — design "General error variant (500)". */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="screen">
      <div className="container">
        <div className="block">
          <ErrorState
            variant="server"
            title="Technical foul on our side"
            description="Something broke while loading this page. Try again in a moment."
            onRetry={reset}
            actions={
              <Button href="/" variant="ghost">
                Home
              </Button>
            }
          />
        </div>
      </div>
    </section>
  );
}
