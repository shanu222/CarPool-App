import { CompareFacesCommand, RekognitionClient } from "@aws-sdk/client-rekognition";

let cachedClient;

const getRekognitionClient = () => {
  if (cachedClient) {
    return cachedClient;
  }

  const region = process.env.AWS_REGION;

  if (!region) {
    throw new Error("AWS_REGION is required for Rekognition face match");
  }

  const hasStaticCreds = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;

  cachedClient = new RekognitionClient({
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

  return cachedClient;
};

export const compareFaceAgainstCnic = async ({ profileBuffer, cnicFrontBuffer, threshold = 80 }) => {
  const client = getRekognitionClient();

  try {
    const command = new CompareFacesCommand({
      SimilarityThreshold: threshold,
      SourceImage: {
        Bytes: profileBuffer,
      },
      TargetImage: {
        Bytes: cnicFrontBuffer,
      },
    });

    const result = await client.send(command);
    const bestMatch = result.FaceMatches?.sort((a, b) => (b.Similarity || 0) - (a.Similarity || 0))?.[0];
    const similarity = Number(bestMatch?.Similarity || 0);

    return {
      matched: similarity >= threshold,
      similarity,
    };
  } catch (error) {
    if (error?.name === "InvalidParameterException") {
      const unclear = new Error("Uploaded image is unclear");
      unclear.statusCode = 400;
      throw unclear;
    }

    throw error;
  }
};
