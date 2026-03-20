import type { NextFunction, Request, Response } from "express";
import { getUploadMiddleware } from "./utils/uploads";

const upload = getUploadMiddleware(__dirname);

export function multerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  upload(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }

    const message =
      err instanceof Error ? err.message : "Upload failed";
    res.status(400).json({ message });
  });
}
