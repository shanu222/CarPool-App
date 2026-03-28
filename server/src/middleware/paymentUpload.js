import multer from "multer";
import path from "node:path";
import fs from "node:fs";

const paymentUploadDir = path.join(process.cwd(), "uploads", "payments");
if (!fs.existsSync(paymentUploadDir)) {
  fs.mkdirSync(paymentUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, paymentUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const allowedMimeTypes = new Set(["image/jpeg", "image/jpg", "image/png", "application/pdf"]);
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".pdf"]);

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const mime = String(file.mimetype || "").toLowerCase();

  if (allowedMimeTypes.has(mime) && allowedExtensions.has(ext)) {
    cb(null, true);
    return;
  }

  cb(new Error("Only .jpg, .jpeg, .png, and .pdf uploads are allowed"));
};

export const paymentUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});
