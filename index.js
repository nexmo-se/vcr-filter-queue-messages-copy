import express from "express";
import promBundle from "express-prom-bundle";

import eventsRouter from "./routers/eventsRoutes.js";
import filterRouter from "./routers/filterRoutes.js";
import queuesRouter from "./routers/queuesRoutes.js";

const app = express();
const PORT = process.env.NERU_APP_PORT || 3000;
const metricsMiddleware = promBundle(
  {
    includePath: true,
    includeMethod: true,
    metricsPath: "/_/metrics",
    httpDurationMetricName: "http_request_duration_seconds"
  }
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));
app.use(metricsMiddleware);

app.get("/", (req, res) => {
  return res.send("App is running.");
});

app.get("/_/health", (req, res) => {
  return res.send("OK");
});

app.get("/_/metrics", async (req, res) => {
  return res.send("OK");
});

app.use("/events/", eventsRouter);
app.use("/whitelist/", filterRouter);
app.use("/queues/", queuesRouter);

app.use((err, req, res, next) => {
  if (process.env.DEBUG || process.env.ENABLE_ERROR_LOG) console.log(err);
  const code = err.statusCode || err.status || 500;
  const detail = err.message? err.message : typeof err === "string"? err : "Something went wrong";
  res.status(code);
  return res.json({ detail, code });
});

app.listen(PORT, () => {
  console.log(
    `Listening on ${process.env.VCR_INSTANCE_PUBLIC_URL || "http://localhost:" + PORT} ...`
  );
});
