require("./tracing");

const express = require("express");
const { version } = require("./package.json");
const prometheus = require("prom-client");
const winston = require("winston");
const LokiTransport = require("winston-loki");
const { trace, context } = require("@opentelemetry/api");

const app = express();
const port = 3200;

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
    new LokiTransport({
      host: process.env.LOKI_URL || "http://127.0.0.1:3100",
      labels: {
        app: "node-app",
        job: "node-app",
        env: process.env.NODE_ENV || "development",
      },
      useWinstonMetaAsLabels: false,
      json: true,
      format: winston.format.json(),
      replaceTimestamp: true,
      batching: true,
      interval: 5,
      clearOnError: true,
      onConnectionError: (err) => console.error("Loki push error:", err),
    }),
  ],
});

const register = new prometheus.Registry();
prometheus.collectDefaultMetrics({ register });

const httpRequestDuration = new prometheus.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

app.use((req, res, next) => {
  if (req.path === "/metrics") return next();

  const startTime = process.hrtime.bigint();
  const end = httpRequestDuration.startTimer();

  const activeSpan = trace.getSpan(context.active());
  const spanContext = activeSpan ? activeSpan.spanContext() : null;
  const traceId = spanContext ? spanContext.traceId : undefined;
  const spanId = spanContext ? spanContext.spanId : undefined;

  if (traceId) {
    res.setHeader("X-Trace-Id", traceId);
  }

  res.on("finish", () => {
    const route = req.route ? req.route.path : "unmatched_route";
    const durationMs = Number(process.hrtime.bigint() - startTime) / 1e6;

    end({
      method: req.method,
      route,
      status_code: res.statusCode,
    });

    if (req.path === "/health" && res.statusCode < 400) return;

    const logData = {
      method: req.method,
      path: req.originalUrl,
      route,
      status: res.statusCode,
      duration_ms: Number(durationMs.toFixed(2)),
      trace_id: traceId,
      span_id: spanId,
      version,
    };

    if (res.statusCode >= 500) {
      logger.error("HTTP Request Failed", logData);
    } else if (res.statusCode >= 400) {
      logger.warn("HTTP Client Error", logData);
    } else {
      logger.info("HTTP Request Completed", logData);
    }
  });

  next();
});

app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    logger.error("Metrics scrape failed", { error: err.message });
    res.status(500).end(err.message);
  }
});

app.get("/", (req, res) => {
  const traceId = trace.getSpan(context.active())?.spanContext().traceId;
  logger.info("Root route hit", { trace_id: traceId, version });
  res.send(
    `Hello World!, Server is running using jenkins file. Version: ${version}`,
  );
});

app.get("/health", (req, res) => {
  res.send("Server is healthy");
});

app.listen(port, "0.0.0.0", () => {
  logger.info("Server started", { port, version });
});
