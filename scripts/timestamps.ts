import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUTPUT_DIR = join(process.cwd(), "docs");
const OUTPUT_FILE = join(OUTPUT_DIR, "generatedAt.json");
const DEFAULT_MAX_LOG = 10;

interface TimestampLog {
  schema_version: number;
  status: string;
  source: string;
  maxlog: number;
  timestamps: string[];
}

export async function updateTimestampLog(): Promise<void> {
  let maxlog = DEFAULT_MAX_LOG;
  let timestamps: string[] = [];

  try {
    const existing = await readFile(OUTPUT_FILE, "utf8");
    const data = JSON.parse(existing) as Partial<TimestampLog>;

    if (typeof data.maxlog === "number" && data.maxlog > 0) {
      maxlog = Math.floor(data.maxlog);
    }

    if (Array.isArray(data.timestamps)) {
      timestamps = data.timestamps.filter(
        (timestamp): timestamp is string => typeof timestamp === "string"
      );
    }
  } catch {
    // File doesn't exist yet, or isn't valid JSON.
    // Use the default maxlog and start a new log.
  }

  timestamps.unshift(new Date().toISOString());
  timestamps = timestamps.slice(0, maxlog);

  const output: TimestampLog = {
    schema_version: 1,
    status: "timestamps",
    source: "BODS Action",
    maxlog,
    timestamps,
  };

  await mkdir(OUTPUT_DIR, { recursive: true });

  await writeFile(
    OUTPUT_FILE,
    JSON.stringify(output, null, 2) + "\n",
    "utf8"
  );
}
