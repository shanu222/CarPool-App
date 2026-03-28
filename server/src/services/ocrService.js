import fs from "node:fs/promises";
import vision from "@google-cloud/vision";
import Tesseract from "tesseract.js";
import sharp from "sharp";
import { normalizeCnic, normalizeDob, normalizeName } from "../utils/kycUtils.js";

let cachedClient;
const OCR_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS || 18000);
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 20000);
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 20000);

const getOpenAiApiKey = () => process.env.OPENAI_API_KEY || "";
const getOpenAiModel = () => process.env.OPENAI_MODEL || "gpt-4o-mini";

const getGeminiApiKey = () =>
  process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY || "";

const getGeminiModel = () => process.env.GEMINI_MODEL || "gemini-1.5-flash";

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

const parseFirstJsonObject = (text) => {
  const raw = String(text || "").trim();

  if (!raw) {
    return null;
  }

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const source = fenced?.[1] ? fenced[1].trim() : raw;

  try {
    return JSON.parse(source);
  } catch {
    const start = source.indexOf("{");
    const end = source.lastIndexOf("}");

    if (start >= 0 && end > start) {
      try {
        return JSON.parse(source.slice(start, end + 1));
      } catch {
        return null;
      }
    }

    return null;
  }
};

const extractLabeledDate = (text, labelPattern) => {
  const raw = String(text || "");
  const labelRegex = new RegExp(
    `(?:${labelPattern})[^\n\r\d]{0,20}(\\d{2}[./-]\\d{2}[./-]\\d{4}|\\d{4}-\\d{2}-\\d{2})`,
    "i"
  );

  const match = raw.match(labelRegex);
  if (!match?.[1]) {
    return "";
  }

  return normalizeDob(match[1]);
};

const extractCnicDataWithOpenAI = async ({ frontBuffer, backBuffer }) => {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    return null;
  }

  const model = getOpenAiModel();
  const endpoint = "https://api.openai.com/v1/chat/completions";

  const prompt = [
    "Extract Pakistani CNIC fields from these two images (front and back).",
    "Return JSON only with keys: name, cnic, dob, cnicExpiry.",
    "Rules:",
    "- name: card holder name under Name label only",
    "- cnic: only CNIC number",
    "- dob: normalize to YYYY-MM-DD",
    "- cnicExpiry: CNIC expiry date from card, normalize to YYYY-MM-DD",
    "- if uncertain, return empty string for that key",
  ].join("\n");

  const requestBody = {
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${frontBuffer.toString("base64")}`,
            },
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${backBuffer.toString("base64")}`,
            },
          },
        ],
      },
    ],
  };

  let response;
  try {
    response = await withTimeout(
      fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      }),
      OPENAI_TIMEOUT_MS
    );
  } catch {
    return null;
  }

  if (!response?.ok) {
    return null;
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    return null;
  }

  const content = payload?.choices?.[0]?.message?.content || "";
  const parsed = parseFirstJsonObject(content);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  return {
    name: normalizeName(parsed.name || ""),
    cnic: normalizeCnic(parsed.cnic || ""),
    dob: normalizeDob(parsed.dob || ""),
    cnicExpiry: normalizeDob(parsed.cnicExpiry || ""),
  };
};

const extractCnicDataWithGemini = async ({ frontBuffer, backBuffer }) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return null;
  }

  const model = getGeminiModel();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = [
    "Extract Pakistani CNIC fields from these two images (front and back).",
    "Return JSON only with keys: name, cnic, dob, cnicExpiry.",
    "Rules:",
    "- name: card holder name under Name label only",
    "- cnic: only CNIC number",
    "- dob: normalize to YYYY-MM-DD",
    "- cnicExpiry: CNIC expiry date from card, normalize to YYYY-MM-DD",
    "- if uncertain, return empty string for that key",
  ].join("\n");

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: frontBuffer.toString("base64"),
            },
          },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: backBuffer.toString("base64"),
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      topP: 0.1,
      maxOutputTokens: 256,
    },
  };

  let response;
  try {
    response = await withTimeout(
      fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }),
      GEMINI_TIMEOUT_MS
    );
  } catch {
    return null;
  }

  if (!response?.ok) {
    return null;
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    return null;
  }

  const textParts = payload?.candidates?.[0]?.content?.parts || [];
  const combinedText = textParts.map((part) => String(part?.text || "")).join("\n");
  const parsed = parseFirstJsonObject(combinedText);

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  return {
    name: normalizeName(parsed.name || ""),
    cnic: normalizeCnic(parsed.cnic || ""),
    dob: normalizeDob(parsed.dob || ""),
    cnicExpiry: normalizeDob(parsed.cnicExpiry || ""),
  };
};

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
  const cnicExpiry =
    extractLabeledDate(raw, "date\\s*of\\s*expiry|expiry|valid\\s*(?:till|until|upto|up to)") || "";

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

  const labelLikeIndex = lines.findIndex(
    (line) => /^\s*na(?:m|rn)e\s*$/i.test(line) || /^\s*na(?:m|rn)e\s*[:\-]/i.test(line)
  );

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

  // Deliberately avoid broad fallback line-scanning for name.
  // On blurry cards, random OCR lines can be mistaken as name and cause false mismatches.

  return {
    cnic: normalizeCnic(cnicMatch?.[0] || ""),
    dob: normalizeDob(dobMatch?.[0] || ""),
    cnicExpiry,
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

const parseLicenseExpiry = (text) => {
  const raw = String(text || "");
  const labeledExpiry =
    extractLabeledDate(raw, "expiry|valid\\s*(?:till|until|upto|up to)|date\\s*of\\s*expiry") || "";

  if (labeledExpiry) {
    return labeledExpiry;
  }

  const dateMatches = [...raw.matchAll(/\b(\d{2}[./-]\d{2}[./-]\d{4}|\d{4}-\d{2}-\d{2})\b/g)]
    .map((match) => normalizeDob(match[1]))
    .filter(Boolean)
    .sort();

  return dateMatches[dateMatches.length - 1] || "";
};

export const extractCnicData = async ({ cnicFrontPath, cnicBackPath }) => {
  const [frontBuffer, backBuffer] = await Promise.all([fs.readFile(cnicFrontPath), fs.readFile(cnicBackPath)]);

  const openAiResult = await extractCnicDataWithOpenAI({ frontBuffer, backBuffer });
  if (openAiResult?.cnic && openAiResult?.dob && openAiResult?.name) {
    return {
      ...openAiResult,
      nameCandidates: openAiResult.name ? [openAiResult.name] : [],
    };
  }

  const aiResult = await extractCnicDataWithGemini({ frontBuffer, backBuffer });
  if (aiResult?.cnic && aiResult?.dob && aiResult?.name) {
    return {
      ...aiResult,
      nameCandidates: aiResult.name ? [aiResult.name] : [],
    };
  }

  const [frontCandidates, backCandidates] = await Promise.all([
    extractTextCandidatesFromBuffer(frontBuffer),
    extractTextCandidatesFromBuffer(backBuffer),
  ]);

  const allCandidates = [];
  const nameCandidates = [];

  for (const frontText of frontCandidates.slice(0, 5)) {
    const parsedFront = parseCnicText(frontText);
    if (parsedFront.name) {
      nameCandidates.push(parsedFront.name);
    }
  }

  const uniqueNameCandidates = [...new Set(nameCandidates.map((value) => String(value || "").trim()).filter(Boolean))];

  for (const frontText of frontCandidates.slice(0, 3)) {
    for (const backText of backCandidates.slice(0, 3)) {
      const parsedFront = parseCnicText(frontText);
      const parsedBack = parseCnicText(backText);

      allCandidates.push({
        cnic: parsedFront.cnic || parsedBack.cnic,
        dob: parsedFront.dob || parsedBack.dob,
        cnicExpiry: parsedFront.cnicExpiry || parsedBack.cnicExpiry,
        name: parsedFront.name || parsedBack.name,
      });
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
      if (parsed.cnicExpiry) {
        score += 2;
      }

      return { parsed, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = ranked[0]?.parsed || { cnic: "", dob: "", name: "" };

  return {
    ...best,
    nameCandidates: uniqueNameCandidates,
  };
};

export const extractLicenseNumber = async (licenseImagePath) => {
  const text = await extractText(licenseImagePath);
  return parseLicenseText(text);
};

export const extractLicenseData = async (licenseImagePath) => {
  const text = await extractText(licenseImagePath);
  return {
    licenseNumber: parseLicenseText(text),
    licenseExpiry: parseLicenseExpiry(text),
  };
};
