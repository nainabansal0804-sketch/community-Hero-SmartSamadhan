import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "firebase/app": path.resolve(__dirname, "./src/firebase-compat.js"),
      "firebase/auth": path.resolve(__dirname, "./src/firebase-compat.js"),
      "firebase/firestore": path.resolve(__dirname, "./src/firebase-compat.js"),
    }
  },
  define: {
    "import.meta.env.VITE_FIREBASE_API_KEY": JSON.stringify(process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || ""),
    "import.meta.env.VITE_FIREBASE_AUTH_DOMAIN": JSON.stringify(process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || ""),
    "import.meta.env.VITE_FIREBASE_PROJECT_ID": JSON.stringify(process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || ""),
    "import.meta.env.VITE_FIREBASE_STORAGE_BUCKET": JSON.stringify(process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || ""),
    "import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID": JSON.stringify(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || ""),
    "import.meta.env.VITE_FIREBASE_APP_ID": JSON.stringify(process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || ""),
    "import.meta.env.VITE_CLOUDINARY_CLOUD_NAME": JSON.stringify(process.env.VITE_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || ""),
    "import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET": JSON.stringify(process.env.VITE_CLOUDINARY_UPLOAD_PRESET || process.env.CLOUDINARY_UPLOAD_PRESET || ""),
  }
})

