import express, { type ErrorRequestHandler, type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found." });
});

const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const statusCode =
    typeof error === "object" && error !== null && "status" in error &&
    typeof error.status === "number" && error.status >= 400 && error.status < 500
      ? error.status
      : 500;
  req.log.error({ err: error, statusCode }, "API request failed");
  res.status(statusCode).json({
    error: statusCode === 500 ? "The server could not complete the request." : "The request could not be processed.",
  });
};

app.use(errorHandler);

export default app;
