import fs from "node:fs/promises";
import { CompareFacesCommand, RekognitionClient } from "@aws-sdk/client-rekognition";

let cachedClient;

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

  const result = await getRekognitionClient().send(
    new CompareFacesCommand({
      SimilarityThreshold: threshold,
      SourceImage: { Bytes: selfieBytes },
      TargetImage: { Bytes: cnicBytes },
    })
  );

  const bestMatch = result.FaceMatches?.sort((a, b) => (b.Similarity || 0) - (a.Similarity || 0))?.[0];
  const similarity = Number(bestMatch?.Similarity || 0);

  return {
    matched: similarity >= threshold,
    similarity,
  };
};
