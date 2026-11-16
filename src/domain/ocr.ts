// Photo/screenshot -> recipe text. Runs in the browser (Tesseract), nothing is uploaded.
// Kept behind one function so it can later be swapped for a server-side Claude vision call
// that returns the recipe directly.
import { cleanOcr } from "./recipe";

export async function extractRecipeText(file: File, onProgress?: (pct: number, status: string) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js"); // loaded on demand to keep the app small
  const worker = await createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => onProgress?.(Math.round((m.progress || 0) * 100), m.status),
  });
  try {
    const { data } = await worker.recognize(file);
    return cleanOcr(data.text);
  } finally {
    await worker.terminate();
  }
}
