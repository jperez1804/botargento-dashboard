import { env } from "@/lib/env";
import type { VerticalConfig } from "./_types";
import { realEstate } from "./real-estate";

const REGISTRY: Readonly<Record<string, VerticalConfig>> = {
  "real-estate": realEstate,
};

let cached: VerticalConfig | null = null;

export function verticalConfig(): VerticalConfig {
  if (cached) return cached;
  const key = env().VERTICAL;
  const found = REGISTRY[key];
  if (!found) {
    const known = Object.keys(REGISTRY).join(", ");
    throw new Error(
      `Unknown VERTICAL="${key}". Available verticals: ${known}. ` +
        `Add a new config under src/config/verticals/ and register it in index.ts.`,
    );
  }
  cached = found;
  return cached;
}

export type { VerticalConfig } from "./_types";
