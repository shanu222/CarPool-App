import mongoose from "mongoose";

const ensureUserIndexes = async () => {
  const usersCollection = mongoose.connection.collection("users");

  const indexes = await usersCollection.indexes();
  const legacyCnicIndex = indexes.find((index) => {
    const keys = Object.keys(index?.key || {});
    return index?.unique === true && keys.length === 1 && keys[0] === "cnicNumber";
  });

  if (legacyCnicIndex?.name) {
    await usersCollection.dropIndex(legacyCnicIndex.name);
  }

  await usersCollection.createIndex(
    { cnicNumber: 1, role: 1 },
    {
      unique: true,
      partialFilterExpression: {
        cnicNumber: { $exists: true, $ne: "" },
        role: { $exists: true, $ne: "" },
      },
    }
  );
};

export const connectDb = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is not set");
  }

  await mongoose.connect(mongoUri);
  await ensureUserIndexes();
};
