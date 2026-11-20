import { getNbaDataSource } from "@/data/static-source";
import { fmtGameDate } from "@/lib/format";
import { getMessages, type Locale } from "@/lib/i18n";
import { LanguageSwitch } from "./language-switch";

/** Snapshot date of the NBA data (YYYY-MM-DD), or null if the data set can't be read. */
function snapshotDate(): string | null {
  try {
    return getNbaDataSource().meta.snapshotDate;
  } catch (err) {
    // The footer must never take the whole layout down; the games report the data error themselves.
    console.error("Footer: NBA data snapshot unavailable", err);
    return null;
  }
}

/** Server Component: reads the data layer directly (static-source is server-only). */
export function Footer({ locale = "en" }: { locale?: Locale }) {
  const t = getMessages(locale);
  const date = snapshotDate();
  return (
    <footer className="footer" data-component="Footer">
      <div className="footer__inner container">
        {date ? (
          <span>
            {t.footer.dataUpdated} <time dateTime={date}>{fmtGameDate(date, locale)}</time>
          </span>
        ) : null}
        <span>{t.footer.disclaimer}</span>
        {/* Below 1024 px only: the TopNav has no room for it there. */}
        <LanguageSwitch className="lang-switch--footer" />
      </div>
    </footer>
  );
}
