// Runs the project's virtualenv Python (.venv) cross-platform, so npm scripts
// work the same on Windows (cmd.exe) and POSIX shells.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const candidates = [
  path.join(".venv", "Scripts", "python.exe"),
  path.join(".venv", "bin", "python"),
];
const python = candidates.find((p) => existsSync(p));

if (!python) {
  console.error(
    "Python sanal ortamı bulunamadı (.venv). Kurulum: python -m venv .venv && " +
      ".venv/Scripts/pip install -r scripts/nba-sync/requirements.txt",
  );
  process.exit(1);
}

const result = spawnSync(python, process.argv.slice(2), { stdio: "inherit" });
process.exit(result.status ?? 1);
