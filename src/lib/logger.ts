import pino, { type Logger } from "pino";
import { env } from "@/lib/env";

declare global {
  // eslint-disable-next-line no-var
  var __logger: Logger | undefined;
}

function build(): Logger {
  const isProd = env().NODE_ENV === "production";
  return pino({
    level: env().LOG_LEVEL,
    ...(isProd
      ? {}
      : {
          transport: {
            target: "pino-pretty",
            options: { colorize: true, translateTime: "HH:MM:ss.l" },
          },
        }),
  });
}

export const logger: Logger = global.__logger ?? build();
if (env().NODE_ENV !== "production") global.__logger = logger;
