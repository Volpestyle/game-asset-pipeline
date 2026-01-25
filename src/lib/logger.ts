type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const COLOR: Record<LogLevel | "reset" | "dim", string> = {
  debug: "\x1b[36m",
  info: "\x1b[32m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  dim: "\x1b[2m",
  reset: "\x1b[0m",
};

function getLogLevel(): LogLevel {
  const env = (process.env.LOG_LEVEL ?? process.env.DEBUG_LEVEL ?? "info").toLowerCase();
  if (env === "debug" || env === "info" || env === "warn" || env === "error") {
    return env;
  }
  return "info";
}

const LOG_LEVEL = getLogLevel();
const LOG_COLOR = (process.env.LOG_COLOR ?? "true").toLowerCase() !== "false";

function shouldLog(level: LogLevel) {
  return LEVELS[level] >= LEVELS[LOG_LEVEL];
}

function redactString(value: string) {
  if (value.startsWith("data:") && value.includes(";base64,")) {
    return `[data-url omitted len=${value.length}]`;
  }
  if (/bearer\s+[a-z0-9\-_\.]+/i.test(value)) {
    return value.replace(/bearer\s+[a-z0-9\-_\.]+/gi, "Bearer [REDACTED]");
  }
  return value;
}

function sanitize(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => sanitize(item));

  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (/authorization|token|api_key|apikey|password/i.test(key)) {
      out[key] = "[REDACTED]";
      continue;
    }
    if (key === "input_image" || key === "input_reference") {
      if (typeof val === "string") {
        out[key] = redactString(val);
      } else {
        out[key] = "[BINARY OMITTED]";
      }
      continue;
    }
    out[key] = sanitize(val);
  }
  return out;
}

function stringifyMeta(meta?: unknown) {
  if (meta === undefined) return "";
  const sanitized = sanitize(meta);
  const json = JSON.stringify(sanitized);
  const max = 4000;
  if (json.length > max) {
    return `${json.slice(0, max)}…(truncated ${json.length - max} chars)`;
  }
  return json;
}

function formatLine(level: LogLevel, message: string, meta?: unknown) {
  const ts = new Date().toISOString();
  const tag = level.toUpperCase().padEnd(5, " ");
  const details = stringifyMeta(meta);
  const suffix = details ? ` ${details}` : "";
  if (!LOG_COLOR) {
    return `${ts} ${tag} ${message}${suffix}`;
  }
  return `${COLOR.dim}${ts}${COLOR.reset} ${COLOR[level]}${tag}${COLOR.reset} ${message}${suffix}`;
}

function write(level: LogLevel, message: string, meta?: unknown) {
  if (!shouldLog(level)) return;
  const line = formatLine(level, message, meta);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, meta?: unknown) => write("debug", message, meta),
  info: (message: string, meta?: unknown) => write("info", message, meta),
  warn: (message: string, meta?: unknown) => write("warn", message, meta),
  error: (message: string, meta?: unknown) => write("error", message, meta),
};
