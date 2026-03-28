import fs from "node:fs/promises";
import { CompareFacesCommand, RekognitionClient } from "@aws-sdk/client-rekognition";

let cachedClient;
const OPENAI_FACE_CONFIDENCE = Number(process.env.OPENAI_FACE_CONFIDENCE || 0.9);
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 20000);

const withTimeout = async (promise, timeoutMs) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("FACE_TIMEOUT")), timeoutMs);
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

const compareFacesWithOpenAI = async (cnicBytes, selfieBytes) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const endpoint = "https://api.openai.com/v1/chat/completions";

  const prompt = [
    "You are verifying identity between two photos.",
    "Photo 1 is CNIC card face photo. Photo 2 is selfie photo.",
    "Return strict JSON: {samePerson:boolean, confidence:number, reason:string}",
    "confidence must be between 0 and 1.",
    "Be conservative. If unclear, set samePerson=false.",
  ].join("\n");

  const body = {
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
              url: `data:image/jpeg;base64,${cnicBytes.toString("base64")}`,
            },
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${selfieBytes.toString("base64")}`,
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
        body: JSON.stringify(body),
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

  const confidence = Number(parsed.confidence || 0);
  return {
    samePerson: Boolean(parsed.samePerson),
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
    reason: String(parsed.reason || "").trim(),
  };
};

const getRekognitionClient = () => {
  if (cachedClient) {
    return cachedClient;
  }

  if (!process.env.AWS_REGION) {
    throw new Error("AWS_REGION is required for face verification");
  }

  const hasStaticCreds = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;

  cachedClient = new RekognitionClient({
    region: process.env.AWS_REGION,
    ...(hasStaticCreds
      ? {
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          },
        }
      : {}),
  });

  return cachedClient;
};

export const compareFaces = async (cnicImage, selfieImage, threshold = 80) => {
  const [cnicBytes, selfieBytes] = await Promise.all([fs.readFile(cnicImage), fs.readFile(selfieImage)]);

  let awsSimilarity = 0;
  let awsMatched = false;

  try {
    const result = await getRekognitionClient().send(
      new CompareFacesCommand({
        SimilarityThreshold: threshold,
        SourceImage: { Bytes: selfieBytes },
        TargetImage: { Bytes: cnicBytes },
      })
    );

    const bestMatch = result.FaceMatches?.sort((a, b) => (b.Similarity || 0) - (a.Similarity || 0))?.[0];
    awsSimilarity = Number(bestMatch?.Similarity || 0);
    awsMatched = awsSimilarity >= threshold;
  } catch {
    awsMatched = false;
  }

  if (awsMatched) {
    return {
      matched: true,
      similarity: awsSimilarity,
      source: "aws",
    };
  }

  const aiResult = await compareFacesWithOpenAI(cnicBytes, selfieBytes);
  if (aiResult?.samePerson && aiResult.confidence >= OPENAI_FACE_CONFIDENCE) {
    return {
      matched: true,
      similarity: awsSimilarity,
      source: "openai",
      openAiConfidence: aiResult.confidence,
      openAiReason: aiResult.reason,
    };
  }

  if (!process.env.AWS_REGION && !process.env.OPENAI_API_KEY) {
    throw new Error("Face verification is not configured");
  }

  return {
    matched: false,
    similarity: awsSimilarity,
    source: aiResult ? "aws+openai" : "aws",
    openAiConfidence: aiResult?.confidence || 0,
    openAiReason: aiResult?.reason || "",
  };
};
