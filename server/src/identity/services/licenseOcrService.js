import vision from "@google-cloud/vision";
import { normalizeLicenseNumber, normalizeName } from "../utils/cnicUtils.js";

let cachedClient;

const getCredentials = () => {
  const raw = process.env.GOOGLE_VISION_CREDENTIALS_JSON;

  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_VISION_CREDENTIALS_JSON is not valid JSON");
  }
};

const getVisionClient = () => {
  if (cachedClient) {
    return cachedClient;
  }

  const credentials = getCredentials();
  cachedClient = credentials
    ? new vision.ImageAnnotatorClient({ credentials })
    : new vision.ImageAnnotatorClient();

  return cachedClient;
};

const toUnclearImageError = () => {
  const unclear = new Error("Uploaded image is unclear");
  unclear.statusCode = 400;
  return unclear;
};

const parseLicenseText = (text) => {
  const raw = String(text || "");
  const normalized = raw.replace(/\r/g, "");

  const labeledMatch = normalized.match(
    /(?:licen[sc]e|driving\s*license|d\.?l\.?)\s*(?:no|number|#)?\s*[:\-]?\s*([A-Z0-9\-/]{5,})/i
  );

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let bestCandidate = labeledMatch ? labeledMatch[1] : "";

  if (!bestCandidate) {
    for (const line of lines) {
      if (!/[A-Za-z]/.test(line) || !/\d/.test(line)) {
        continue;
      }

      if (/license|driving|authority|pakistan|issue|expiry|valid/i.test(line)) {
        continue;
      }

      const compact = normalizeLicenseNumber(line);

      if (compact.length < 6) {
        continue;
      }

      bestCandidate = line;
      break;
    }
  }

  const excludedNameKeywords = [
    "driving",
    "license",
    "licence",
    "authority",
    "pakistan",
    "government",
    "issue",
    "expiry",
    "class",
    "valid",
    "number",
    "address",
    "blood",
    "group",
    "holder",
  ];

  let name = "";

  for (const line of lines) {
    if (/\d/.test(line) || line.length < 3) {
      continue;
    }

    const lowered = line.toLowerCase();

    if (excludedNameKeywords.some((keyword) => lowered.includes(keyword))) {
      continue;
    }

    if (/^[a-z\s.]+$/i.test(line)) {
      name = line;
      break;
    }
  }

  return {
    licenseNumber: normalizeLicenseNumber(bestCandidate),
    name: normalizeName(name),
    rawText: normalized,
  };
};

export const extractLicenseDataFromImage = async ({ licenseBuffer }) => {
  const client = getVisionClient();
  const [result] = await client.textDetection({ image: { content: licenseBuffer } });
  const text = result?.fullTextAnnotation?.text || result?.textAnnotations?.[0]?.description || "";

  if (!text.trim()) {
    throw toUnclearImageError();
  }

  const parsed = parseLicenseText(text);

  if (!parsed.licenseNumber) {
    throw toUnclearImageError();
  }

  return parsed;
};
