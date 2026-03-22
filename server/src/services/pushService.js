import admin from "firebase-admin";

let firebaseReady = false;

const initializeFirebase = () => {
  if (firebaseReady || admin.apps.length > 0) {
    firebaseReady = true;
    return true;
  }

  const rawCredential = process.env.FIREBASE_SERVER_KEY;

  if (!rawCredential) {
    return false;
  }

  try {
    const parsed = JSON.parse(rawCredential);

    admin.initializeApp({
      credential: admin.credential.cert(parsed),
    });

    firebaseReady = true;
    return true;
  } catch {
    return false;
  }
};

export const sendPushNotification = async ({ token, title, body, data = {} }) => {
  if (!token || !initializeFirebase()) {
    return;
  }

  try {
    await admin.messaging().send({
      token,
      notification: {
        title,
        body,
      },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    });
  } catch {
    // Ignore push errors to keep API non-blocking.
  }
};
