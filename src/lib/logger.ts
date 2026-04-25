import pino, { type Logger } from "pino";
import { env } from "@/lib/env";

declare global {
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

function getLogger(): Logger {
  if (global.__logger) return global.__logger;

  const instance = build();
  if (env().NODE_ENV !== "production") {
    global.__logger = instance;
  }

  return instance;
}

// Keep call sites unchanged while deferring env reads until runtime.
export const logger = new Proxy({} as Logger, {
  get(_target, prop, receiver) {
    return Reflect.get(getLogger(), prop, receiver);
  },
}) as Logger;
