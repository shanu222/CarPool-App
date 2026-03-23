import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAyh2oGCNgL24NHeBYL5dvxFZSw1dvY0Jk",
  authDomain: "carpool-91828.firebaseapp.com",
  projectId: "carpool-91828",
  storageBucket: "carpool-91828.appspot.com",
  messagingSenderId: "1035176758363",
  appId: "1:1035176758363:web:dd11f2edf09ea61de9437e",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
