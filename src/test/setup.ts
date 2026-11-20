// Component tests opt into jsdom per file with `// @vitest-environment jsdom`.
import "@testing-library/jest-dom/vitest";
import { en } from "@/lib/i18n";
import { setI18nFallback } from "@/lib/i18n/provider";

// Production has no English fallback (it would ship the dictionary to every page); isolated
// component tests render without the root layout, so they get English here.
setI18nFallback({ locale: "en", t: en });
