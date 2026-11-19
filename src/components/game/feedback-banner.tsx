import { Icon } from "@/components/ui/icon";

export type FeedbackKind = "correct" | "wrong" | "timeout";

export function FeedbackBanner({ kind, message }: { kind: FeedbackKind | null; message: string }) {
  return (
    <div className="feedback-banner" role="status" data-state={kind ?? "none"}>
      {kind ? (
        <>
          <Icon name={kind === "correct" ? "check" : kind === "timeout" ? "clock" : "x"} />
          <span>{message}</span>
        </>
      ) : null}
    </div>
  );
}
