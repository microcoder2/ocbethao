import fs from "fs";
import path from "path";
import multer from "multer";

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

let _publicDir: string | null = null;

export function resolvePublicDir(baseDir: string): string {
  const publicDir = path.resolve(baseDir, "..", "public");
  _publicDir = publicDir;
  ensureDir(publicDir);
  ensureDir(path.join(publicDir, "uploads"));
  return publicDir;
}

export function deletePublicImage(imageUrl: string): void {
  if (!_publicDir || !imageUrl.startsWith("/uploads/")) return;
  const fileName = path.basename(imageUrl);
  const filePath = path.join(_publicDir, "uploads", fileName);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // best-effort — don't fail the request over a stale file
  }
}

function createFileName(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase() || ".jpg";
  const safeExt = ext.slice(0, 10);
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`;
}

export function getUploadMiddleware(baseDir: string) {
  const publicDir = resolvePublicDir(baseDir);

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, path.join(publicDir, "uploads"));
    },
    filename: (_req, file, cb) => {
      cb(null, createFileName(file.originalname));
    },
  });

  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
        cb(new Error("Only image uploads are allowed"));
        return;
      }
      cb(null, true);
    },
  }).single("file");
}

export function getPublicImageUrl(fileName: string): string {
  return `/uploads/${fileName}`;
}
