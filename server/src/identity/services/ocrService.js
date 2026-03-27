import vision from "@google-cloud/vision";
import { parseCnicText } from "../utils/cnicUtils.js";

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

export const extractCnicDataFromImages = async ({ frontBuffer, backBuffer }) => {
  const client = getVisionClient();

  const [frontResult] = await client.textDetection({ image: { content: frontBuffer } });
  const frontText = frontResult?.fullTextAnnotation?.text || frontResult?.textAnnotations?.[0]?.description || "";

  const [backResult] = await client.textDetection({ image: { content: backBuffer } });
  const backText = backResult?.fullTextAnnotation?.text || backResult?.textAnnotations?.[0]?.description || "";

  const combined = `${frontText}\n${backText}`.trim();

  if (!combined) {
    const unclear = new Error("Uploaded image is unclear");
    unclear.statusCode = 400;
    throw unclear;
  }

  const parsed = parseCnicText(combined);

  if (!parsed.cnic || !parsed.dob || !parsed.name) {
    const unclear = new Error("Uploaded image is unclear");
    unclear.statusCode = 400;
    throw unclear;
  }

  return parsed;
};
