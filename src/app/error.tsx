"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { useT } from "@/lib/i18n/provider";

/** Route error boundary — design "General error variant (500)". */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="screen">
      <div className="container">
        <div className="block">
          <ErrorState
            variant="server"
            title={t.routeError.title}
            description={t.routeError.description}
            onRetry={reset}
            actions={
              <Button href="/" variant="ghost">
                {t.common.home}
              </Button>
            }
          />
        </div>
      </div>
    </section>
  );
}
