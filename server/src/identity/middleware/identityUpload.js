import multer from "multer";

const allowedImageTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export const identityUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.IDENTITY_MAX_IMAGE_SIZE_BYTES || 8 * 1024 * 1024),
  },
  fileFilter: (_req, file, cb) => {
    if (allowedImageTypes.has(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new Error("Only JPEG, PNG, and WEBP images are allowed"));
  },
});
