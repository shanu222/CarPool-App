import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from "node:fs";
import path from "node:path";

const localRoot = path.resolve(process.cwd(), "uploads", "identity");

const ensureLocalDirectory = () => {
  if (!fs.existsSync(localRoot)) {
    fs.mkdirSync(localRoot, { recursive: true });
  }
};

const extensionFromMime = (mimeType = "") => {
  if (mimeType.includes("png")) {
    return ".png";
  }

  if (mimeType.includes("webp")) {
    return ".webp";
  }

  return ".jpg";
};

const buildFileName = (fieldName, mimeType) => {
  const extension = extensionFromMime(mimeType);
  return `${Date.now()}-${fieldName}-${Math.round(Math.random() * 1e9)}${extension}`;
};

let s3Client;

const getS3Client = () => {
  if (s3Client) {
    return s3Client;
  }

  const region = process.env.AWS_REGION;

  if (!region) {
    throw new Error("AWS_REGION is required for S3 storage backend");
  }

  const hasStaticCreds = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;

  s3Client = new S3Client({
    region,
    ...(hasStaticCreds
      ? {
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          },
        }
      : {}),
  });

  return s3Client;
};

const uploadToS3 = async ({ file }) => {
  const bucket = process.env.S3_BUCKET;

  if (!bucket) {
    throw new Error("S3_BUCKET is required when STORAGE_BACKEND=s3");
  }

  const key = `identity/${buildFileName(file.fieldname, file.mimetype)}`;
  const region = process.env.AWS_REGION;

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
};

const saveLocal = async ({ file }) => {
  ensureLocalDirectory();

  const filename = buildFileName(file.fieldname, file.mimetype);
  const absolutePath = path.join(localRoot, filename);

  await fs.promises.writeFile(absolutePath, file.buffer);

  return `/uploads/identity/${filename}`;
};

export const saveVerificationFile = async ({ file }) => {
  if (!file?.buffer) {
    throw new Error("Verification file buffer is missing");
  }

  const backend = String(process.env.STORAGE_BACKEND || "local").toLowerCase();

  if (backend === "s3") {
    return uploadToS3({ file });
  }

  return saveLocal({ file });
};
