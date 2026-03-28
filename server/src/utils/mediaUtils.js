import fs from "node:fs";
import path from "node:path";

const uploadsRoot = path.resolve(path.join(process.cwd(), "uploads"));

let sharpLoader;

const getSharp = async () => {
  if (sharpLoader === undefined) {
    sharpLoader = import("sharp")
      .then((module) => module.default || module)
      .catch(() => null);
  }

  return sharpLoader;
};

export const toPublicUploadPath = (file) => {
  const rawPath = String(file?.path || "").trim();

  if (!rawPath) {
    return "";
  }

  const normalized = rawPath.replace(/\\/g, "/");
  const uploadsMarker = "/uploads/";
  const markerIndex = normalized.lastIndexOf(uploadsMarker);

  if (markerIndex >= 0) {
    return normalized.slice(markerIndex);
  }

  const filename = path.basename(normalized);
  return filename ? `/uploads/${filename}` : "";
};

export const removeUploadFileIfExists = async (publicPath) => {
  const raw = String(publicPath || "").trim();

  let normalizedRaw = raw;

  if (/^https?:\/\//i.test(normalizedRaw)) {
    try {
      normalizedRaw = new URL(normalizedRaw).pathname || "";
    } catch {
      normalizedRaw = raw;
    }
  }

  if (!normalizedRaw || !normalizedRaw.startsWith("/uploads/")) {
    return;
  }

  const normalized = normalizedRaw.replace(/\\/g, "/");
  const absolutePath = path.resolve(process.cwd(), `.${normalized}`);

  if (!absolutePath.startsWith(uploadsRoot)) {
    return;
  }

  try {
    await fs.promises.unlink(absolutePath);
  } catch {
    // Ignore missing/locked files to avoid blocking profile updates.
  }
};

export const optimizeUploadedImage = async (filePath, options = {}) => {
  const inputPath = String(filePath || "").trim();
  if (!inputPath) {
    return false;
  }

  const sharp = await getSharp();
  if (!sharp) {
    return false;
  }

  const maxWidth = Number(options.maxWidth || 1280);
  const jpegQuality = Number(options.jpegQuality || 82);
  const pngCompressionLevel = Number(options.pngCompressionLevel || 9);

  try {
    const pipeline = sharp(inputPath)
      .rotate()
      .resize({
        width: maxWidth,
        height: maxWidth,
        fit: "inside",
        withoutEnlargement: true,
      });

    const metadata = await pipeline.metadata();
    const format = String(metadata?.format || "").toLowerCase();

    let optimizedBuffer;

    if (format === "png") {
      optimizedBuffer = await pipeline.png({ compressionLevel: pngCompressionLevel }).toBuffer();
    } else if (format === "webp") {
      optimizedBuffer = await pipeline.webp({ quality: jpegQuality }).toBuffer();
    } else {
      optimizedBuffer = await pipeline.jpeg({ quality: jpegQuality, mozjpeg: true }).toBuffer();
    }

    await fs.promises.writeFile(inputPath, optimizedBuffer);
    return true;
  } catch {
    return false;
  }
};
