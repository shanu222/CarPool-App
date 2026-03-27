import fs from "node:fs/promises";
import vision from "@google-cloud/vision";
import Tesseract from "tesseract.js";
import { CompareFacesCommand, RekognitionClient } from "@aws-sdk/client-rekognition";
import { parseCnicText } from "../utils/kycUtils.js";

let cachedVisionClient;
let cachedRekognitionClient;

const getVisionCredentials = () => {
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
  if (cachedVisionClient) {
    return cachedVisionClient;
  }

  const credentials = getVisionCredentials();
  cachedVisionClient = credentials
    ? new vision.ImageAnnotatorClient({ credentials })
    : new vision.ImageAnnotatorClient();

  return cachedVisionClient;
};

const extractTextWithVision = async (buffer) => {
  const client = getVisionClient();
  const [result] = await client.textDetection({ image: { content: buffer } });
  return result?.fullTextAnnotation?.text || result?.textAnnotations?.[0]?.description || "";
};

const extractTextWithTesseract = async (buffer) => {
  const result = await Tesseract.recognize(buffer, "eng");
  return result?.data?.text || "";
};

const extractText = async (buffer) => {
  const shouldUseTesseract = process.env.KYC_OCR_PROVIDER === "tesseract";

  if (!shouldUseTesseract) {
    try {
      return await extractTextWithVision(buffer);
    } catch (error) {
      if (process.env.KYC_OCR_PROVIDER === "vision") {
        throw error;
      }
      return extractTextWithTesseract(buffer);
    }
  }

  return extractTextWithTesseract(buffer);
};

const hasRekognitionCredentials = () =>
  Boolean(process.env.AWS_REGION && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

const getRekognitionClient = () => {
  if (cachedRekognitionClient) {
    return cachedRekognitionClient;
  }

  if (!hasRekognitionCredentials()) {
    throw new Error("AWS Rekognition credentials are not configured");
  }

  cachedRekognitionClient = new RekognitionClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  return cachedRekognitionClient;
};

export const extractCnicDataFromImages = async ({ cnicFrontPath, cnicBackPath }) => {
  const [frontBuffer, backBuffer] = await Promise.all([fs.readFile(cnicFrontPath), fs.readFile(cnicBackPath)]);

  const [frontText, backText] = await Promise.all([extractText(frontBuffer), extractText(backBuffer)]);
  const parsed = parseCnicText(`${frontText}\n${backText}`.trim());

  if (!parsed.name || !parsed.cnic || !parsed.dob) {
    return {
      success: false,
      errorMessage: "Unable to extract CNIC data",
      parsed,
    };
  }

  return {
    success: true,
    parsed,
  };
};

export const compareFaceWithSelfie = async ({ cnicFrontPath, selfiePath, threshold = 80 }) => {
  try {
    const client = getRekognitionClient();
    const [cnicFrontBytes, selfieBytes] = await Promise.all([fs.readFile(cnicFrontPath), fs.readFile(selfiePath)]);

    const command = new CompareFacesCommand({
      SimilarityThreshold: threshold,
      SourceImage: { Bytes: selfieBytes },
      TargetImage: { Bytes: cnicFrontBytes },
    });

    const result = await client.send(command);
    const bestMatch = result.FaceMatches?.sort((a, b) => (b.Similarity || 0) - (a.Similarity || 0))?.[0];
    const similarity = Number(bestMatch?.Similarity || 0);

    return {
      matched: similarity >= threshold,
      similarity,
    };
  } catch {
    return {
      matched: false,
      similarity: 0,
    };
  }
};
