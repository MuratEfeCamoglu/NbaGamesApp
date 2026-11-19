import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createStaticDataSource, type SeedFiles } from "./build-source";
import { seedFileSchemas, type SeedFileName } from "./schema";
import type { NbaDataSource } from "./source";

let instance: NbaDataSource | undefined;

/** Lazy singleton over src/data/seed/*.json (produced by `npm run data:sync`). */
export function getNbaDataSource(): NbaDataSource {
  if (!instance) {
    const dir = path.join(process.cwd(), "src", "data", "seed");
    const files = Object.fromEntries(
      (Object.keys(seedFileSchemas) as SeedFileName[]).map((name) => [
        name,
        JSON.parse(readFileSync(path.join(dir, name), "utf8")) as unknown,
      ]),
    ) as SeedFiles;
    instance = createStaticDataSource(files);
  }
  return instance;
}
