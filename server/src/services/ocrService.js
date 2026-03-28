import fs from "node:fs/promises";
import vision from "@google-cloud/vision";
import Tesseract from "tesseract.js";
import { normalizeCnic, normalizeDob, normalizeName } from "../utils/kycUtils.js";

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

export const extractText = async (imagePath) => {
  const buffer = await fs.readFile(imagePath);

  try {
    const tesseractResult = await Tesseract.recognize(buffer, "eng");
    const extracted = tesseractResult?.data?.text || "";

    if (String(extracted).trim()) {
      return extracted;
    }
  } catch {
    // Fall back to Vision OCR when Tesseract cannot parse the image.
  }

  const client = getVisionClient();
  const [result] = await client.textDetection({ image: { content: buffer } });
  return result?.fullTextAnnotation?.text || result?.textAnnotations?.[0]?.description || "";
};

const parseCnicText = (text) => {
  const raw = String(text || "");
  const cnicMatch = raw.match(/\b\d{5}-?\d{7}-?\d\b/);
  const dobMatch = raw.match(/\b\d{2}[./-]\d{2}[./-]\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/);

  const lines = raw
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const skipKeywords = [
    "name",
    "identity",
    "card",
    "national",
    "pakistan",
    "cnic",
    "birth",
    "dob",
    "gender",
    "father",
    "husband",
    "expiry",
    "issue",
  ];

  const labeledNameMatch = raw.match(/(?:^|\n)\s*name\s*[:\-]?\s*(?:\n\s*)?([a-z][a-z\s.]{2,})/im);
  let name = labeledNameMatch?.[1] ? labeledNameMatch[1].trim() : "";

  for (const line of lines) {
    if (name) {
      break;
    }

    if (line.length < 3 || /\d/.test(line)) {
      continue;
    }

    const lowered = line.toLowerCase();

    if (["name", "father name", "father's name", "date of birth", "identity number"].includes(lowered)) {
      continue;
    }

    if (skipKeywords.some((keyword) => lowered.includes(keyword))) {
      continue;
    }

    if (/^[a-z\s.]+$/i.test(line)) {
      name = line;
      break;
    }
  }

  return {
    cnic: normalizeCnic(cnicMatch?.[0] || ""),
    dob: normalizeDob(dobMatch?.[0] || ""),
    name: normalizeName(name),
  };
};

const normalizeLicenseNumber = (value) =>
  String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();

const parseLicenseText = (text) => {
  const raw = String(text || "");
  const labeled = raw.match(
    /(?:licen[sc]e|driving\s*license|d\.?l\.?)\s*(?:no|number|#)?\s*[:\-]?\s*([A-Z0-9\-/]{5,})/i
  );

  if (labeled?.[1]) {
    return normalizeLicenseNumber(labeled[1]);
  }

  const lines = raw
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (!/[a-z]/i.test(line) || !/\d/.test(line)) {
      continue;
    }

    if (/license|licence|authority|pakistan|issue|expiry|valid/i.test(line)) {
      continue;
    }

    const normalized = normalizeLicenseNumber(line);

    if (normalized.length >= 6) {
      return normalized;
    }
  }

  return "";
};

export const extractCnicData = async ({ cnicFrontPath, cnicBackPath }) => {
  const [frontText, backText] = await Promise.all([extractText(cnicFrontPath), extractText(cnicBackPath)]);
  return parseCnicText(`${frontText}\n${backText}`.trim());
};

export const extractLicenseNumber = async (licenseImagePath) => {
  const text = await extractText(licenseImagePath);
  return parseLicenseText(text);
};
