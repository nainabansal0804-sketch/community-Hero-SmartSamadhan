import { getAuth, GoogleAuthProvider, getFirestore } from "./firebase-compat.js";

export const auth = getAuth();
export const provider = new GoogleAuthProvider();
export const db = getFirestore();

