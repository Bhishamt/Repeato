type LogLevel = "info" | "warn" | "error" | "debug";

type StructuredLog = {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: unknown;
  error?: {
    name?: string;
    message: string;
    stack?: string;
  };
};

function format(level: LogLevel, message: string, context?: string, data?: unknown): void {
  const entry: StructuredLog = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  };

  if (data instanceof Error) {
    entry.error = {
      name: data.name,
      message: data.message,
      stack: process.env.NODE_ENV !== "production" ? data.stack : undefined,
    };
  } else if (data !== undefined) {
    entry.data = data;
  }

  const json = JSON.stringify(entry);
  if (level === "error") {
    console.error(json);
  } else if (level === "warn") {
    console.warn(json);
  } else {
    console.log(json);
  }
}

export const logger = {
  info: (message: string, context?: string, data?: unknown) => format("info", message, context, data),
  warn: (message: string, context?: string, data?: unknown) => format("warn", message, context, data),
  error: (message: string, context?: string, data?: unknown) => format("error", message, context, data),
  debug: (message: string, context?: string, data?: unknown) => {
    if (process.env.NODE_ENV !== "production") format("debug", message, context, data);
  },
};

