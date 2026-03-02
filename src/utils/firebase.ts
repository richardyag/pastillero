import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore as _getFirestore, type Firestore } from 'firebase/firestore';

// Vars inyectadas en build-time por Vite (desde .env.local o GitHub Secrets).
// Si falta alguna, todas las funciones de sync son no-op.
const API_KEY    = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
const AUTH_DOM   = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
const APP_ID     = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined;

let _app: FirebaseApp | null = null;
let _db:  Firestore   | null = null;

export function isFirebaseConfigured(): boolean {
  return !!(API_KEY && AUTH_DOM && PROJECT_ID && APP_ID);
}

export function getFirestoreDB(): Firestore | null {
  if (!isFirebaseConfigured()) return null;
  if (!_db) {
    _app = initializeApp({ apiKey: API_KEY, authDomain: AUTH_DOM, projectId: PROJECT_ID, appId: APP_ID });
    _db  = _getFirestore(_app);
  }
  return _db;
}
