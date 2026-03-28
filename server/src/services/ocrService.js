import fs from "node:fs/promises";
import vision from "@google-cloud/vision";
import Tesseract from "tesseract.js";
import sharp from "sharp";
import { normalizeCnic, normalizeDob, normalizeName } from "../utils/kycUtils.js";

let cachedClient;
const OCR_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS || 18000);

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

const withTimeout = async (promise, timeoutMs) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("OCR_TIMEOUT")), timeoutMs);
    }),
  ]);

const getOcrVariants = async (buffer) => {
  const variants = [buffer];

  try {
    const enhanced = await sharp(buffer).grayscale().normalize().sharpen().toBuffer();
    variants.push(enhanced);
  } catch {
    // Keep original buffer when enhancement fails.
  }

  try {
    const thresholded = await sharp(buffer)
      .grayscale()
      .normalize()
      .threshold(165)
      .sharpen()
      .toBuffer();
    variants.push(thresholded);
  } catch {
    // Threshold variant is optional.
  }

  return variants;
};

const scoreOcrText = (text) => {
  const value = String(text || "");
  if (!value.trim()) {
    return 0;
  }

  let score = 0;
  if (/\b\d{5}-?\d{7}-?\d\b/.test(value)) {
    score += 6;
  }

  if (/\b\d{2}[./-]\d{2}[./-]\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/.test(value)) {
    score += 4;
  }

  if (/\bna(?:m|rn)e\b/i.test(value)) {
    score += 3;
  }

  if (/\bidentity\s*number\b/i.test(value)) {
    score += 2;
  }

  score += Math.min(4, Math.floor(value.trim().length / 120));
  return score;
};

const mergeUniqueLines = (texts) => {
  const seen = new Set();
  const merged = [];

  for (const text of texts) {
    const lines = String(text || "")
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      const key = line.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(line);
      }
    }
  }

  return merged.join("\n");
};

const extractTextWithVision = async (buffer) => {
  try {
    const client = getVisionClient();
    const [result] = await withTimeout(client.textDetection({ image: { content: buffer } }), OCR_TIMEOUT_MS);
    return result?.fullTextAnnotation?.text || result?.textAnnotations?.[0]?.description || "";
  } catch {
    return "";
  }
};

const extractTextWithTesseract = async (buffer) => {
  try {
    const result = await withTimeout(
      Tesseract.recognize(buffer, "eng", {
        tessedit_pageseg_mode: 6,
      }),
      OCR_TIMEOUT_MS
    );

    return result?.data?.text || "";
  } catch {
    return "";
  }
};

const extractTextCandidatesFromBuffer = async (buffer) => {
  const variants = await getOcrVariants(buffer);
  const texts = [];

  for (const variant of variants) {
    const [visionText, tesseractText] = await Promise.all([
      extractTextWithVision(variant),
      extractTextWithTesseract(variant),
    ]);

    if (visionText.trim()) {
      texts.push(visionText);
    }

    if (tesseractText.trim()) {
      texts.push(tesseractText);
    }
  }

  const ranked = texts
    .map((text) => ({ text, score: scoreOcrText(text) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.text);

  if (!ranked.length) {
    return [""];
  }

  const merged = mergeUniqueLines(ranked);
  return [merged, ...ranked];
};

export const extractText = async (imagePath) => {
  const buffer = await fs.readFile(imagePath);
  const candidates = await extractTextCandidatesFromBuffer(buffer);
  return candidates[0] || "";
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

  const cleanNameCandidate = (value) => {
    const cleaned = String(value || "")
      .replace(/[^a-z\s.]/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned || /\d/.test(cleaned)) {
      return "";
    }

    const lowered = cleaned.toLowerCase();
    if (skipKeywords.some((keyword) => lowered.includes(keyword))) {
      return "";
    }

    const tokens = cleaned.split(" ").filter(Boolean);
    if (tokens.length === 0 || tokens.length > 4 || tokens.some((token) => token.length < 2)) {
      return "";
    }

    return cleaned;
  };

  const labelLikeIndex = lines.findIndex((line) => /^\s*na(?:m|rn)e\s*$/i.test(line) || /^\s*na(?:m|rn)e\s*[:\-]/i.test(line));

  let name = "";

  if (labelLikeIndex >= 0) {
    const afterLabel = lines.slice(labelLikeIndex, labelLikeIndex + 3);
    for (const candidate of afterLabel) {
      const inline = candidate.match(/na(?:m|rn)e\s*[:\-]?\s*(.+)$/i)?.[1] || "";
      const parsed = cleanNameCandidate(inline || candidate);
      if (parsed) {
        name = parsed;
        break;
      }
    }
  }

  if (!name) {
    const labeledNameMatch = raw.match(/(?:^|\n)\s*na(?:m|rn)e\s*[:\-]?\s*(?:\n\s*)?([^\n\r]+)/im);
    name = cleanNameCandidate(labeledNameMatch?.[1] || "");
  }

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
      name = cleanNameCandidate(line);
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
  const [frontBuffer, backBuffer] = await Promise.all([fs.readFile(cnicFrontPath), fs.readFile(cnicBackPath)]);
  const [frontCandidates, backCandidates] = await Promise.all([
    extractTextCandidatesFromBuffer(frontBuffer),
    extractTextCandidatesFromBuffer(backBuffer),
  ]);

  const allCandidates = [];

  for (const frontText of frontCandidates.slice(0, 3)) {
    for (const backText of backCandidates.slice(0, 3)) {
      allCandidates.push(parseCnicText(`${frontText}\n${backText}`.trim()));
    }
  }

  const ranked = allCandidates
    .map((parsed) => {
      let score = 0;
      if (parsed.cnic) {
        score += 6;
      }
      if (parsed.dob) {
        score += 4;
      }
      if (parsed.name) {
        score += 4;
      }

      return { parsed, score };
    })
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.parsed || { cnic: "", dob: "", name: "" };
};

export const extractLicenseNumber = async (licenseImagePath) => {
  const text = await extractText(licenseImagePath);
  return parseLicenseText(text);
};
