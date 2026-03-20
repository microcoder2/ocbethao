import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import os from "os";
import swaggerUi from "swagger-ui-express";
import swaggerDocument from "../swagger/swagger.json";
import { RegisterRoutes } from "./routes/routes";
import { multerMiddleware } from "./middleware";
import { getPublicImageUrl, resolvePublicDir } from "./utils/uploads";

const env = process.env.NODE_ENV || "development";
dotenv.config();
dotenv.config({ path: `.env.${env}`, override: true });

const app = express();
const baseDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
const publicDir = resolvePublicDir(baseDir);
app.use(express.static(publicDir));

const staticOrigins = ["http://localhost:5174", "http://127.0.0.1:5174"];
const envOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...staticOrigins, ...envOrigins]);

function isPrivateLanHost(hostname: string): boolean {
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local")
  ) {
    return true;
  }

  return (
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

function isAllowedOrigin(origin: string): boolean {
  if (allowedOrigins.has(origin)) {
    return true;
  }

  if (env === "development") {
    try {
      const url = new URL(origin);
      return isPrivateLanHost(url.hostname);
    } catch {
      return false;
    }
  }

  return false;
}

function getNetworkUrls(port: number): string[] {
  const interfaces = os.networkInterfaces();
  const urls = new Set<string>();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family !== "IPv4" || entry.internal) {
        continue;
      }
      urls.add(`http://${entry.address}:${port}`);
    }
  }

  return Array.from(urls);
}

function printStartupUrls(host: string, port: number): void {
  const localUrls: string[] = [];
  const networkUrls: string[] = [];

  if (host === "0.0.0.0" || host === "::") {
    localUrls.push(`http://localhost:${port}`);
    networkUrls.push(...getNetworkUrls(port));
  } else if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    localUrls.push(`http://localhost:${port}`);
  } else {
    networkUrls.push(`http://${host}:${port}`);
  }

  const primaryUrl = localUrls[0] || networkUrls[0] || `http://${host}:${port}`;

  console.log("");
  console.log(`  Oc Be Thao API running in ${env} mode`);
  for (const url of localUrls) {
    console.log(`  Local:   ${url}`);
  }
  for (const url of networkUrls) {
    console.log(`  Network: ${url}`);
  }
  console.log(`  Docs:    ${primaryUrl}/api-docs`);
  console.log("");
}

app.use(bodyParser.json());
app.use(cookieParser());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "ocbethao-api", env });
});

RegisterRoutes(app);

app.post("/api/uploads/images", multerMiddleware, (req, res) => {
  const file = (req as { file?: Express.Multer.File }).file;
  if (!file) {
    res.status(400).json({ message: "Missing file" });
    return;
  }
  res.status(200).json({
    url: getPublicImageUrl(file.filename),
    size: file.size,
    mime: file.mimetype,
  });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(
  (
    err: Error & { status?: number; code?: string; fields?: Record<string, unknown> },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const status = typeof err.status === "number" ? err.status : 500;
    const base = err.fields
      ? { message: err.message || "Validation error", fields: err.fields }
      : { message: err.message || "Internal Server Error" };
    res.status(status).json(err.code ? { ...base, code: err.code } : base);
  }
);

const port = Number(process.env.PORT || 3100);
const host = process.env.HOST || "0.0.0.0";
app.listen(port, host, () => {
  printStartupUrls(host, port);
});

export default app;
