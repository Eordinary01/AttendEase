import { useState, useEffect, useCallback } from "react";
import { loadFaceApiScript, getWeightsUrl } from "../utils/faceApiLoader";

const MODEL_URL = getWeightsUrl();

const MODELS = [
  { netKey: "TinyFaceDetector", label: "Face Detector", fallbackKeys: ["tinyFaceDetector", "ssdMobilenetv1", "SsdMobilenetv1"] },
  { netKey: "FaceLandmark68Net", label: "Face Landmarks", fallbackKeys: ["faceLandmark68Net", "faceLandmark68TinyNet"] },
  { netKey: "FaceRecognitionNet", label: "Face Recognition", fallbackKeys: ["faceRecognitionNet"] },
];

// Global cache so models are only downloaded and initialized ONCE across the entire application lifetime
let globalModelsLoaded = false;
let globalLoadingPromise = null;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(label + " timed out after " + ms / 1000 + "s")), ms)
    ),
  ]);
}

function findNet(faceapi, model) {
  if (faceapi.nets?.[model.netKey]) return faceapi.nets[model.netKey];
  for (const key of model.fallbackKeys || []) {
    if (faceapi.nets?.[key]) return faceapi.nets[key];
  }
  const allKeys = Object.keys(faceapi.nets || {});
  const match = allKeys.find((k) => k.toLowerCase() === model.netKey.toLowerCase());
  if (match) return faceapi.nets[match];
  const baseName = model.netKey.replace(/Net$|v1$|v2$/g, "").toLowerCase();
  const partial = allKeys.find((k) => k.toLowerCase().includes(baseName));
  if (partial) return faceapi.nets[partial];
  return null;
}

export default function useFaceModels() {
  const [progress, setProgress] = useState(globalModelsLoaded ? 100 : 0);
  const [modelName, setModelName] = useState("");
  const [ready, setReady] = useState(globalModelsLoaded);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (globalModelsLoaded) {
      setReady(true);
      setProgress(100);
      return;
    }

    if (globalLoadingPromise) {
      try {
        await globalLoadingPromise;
        setReady(true);
        setProgress(100);
        return;
      } catch (err) {
        setError(err.message || "Failed to load face recognition models");
        setReady(false);
        return;
      }
    }

    globalLoadingPromise = (async () => {
      setProgress(20);
      setModelName("Initializing face engine...");

      const faceapi = await withTimeout(loadFaceApiScript(), 20000, "Script load");
      if (!faceapi) {
        throw new Error("face-api.js did not load — check your network connection");
      }

      setProgress(40);
      setModelName("Loading neural net weights...");

      // Parallel download and initialization of all 4 models
      await Promise.all(
        MODELS.map(async (m) => {
          const net = findNet(faceapi, m);
          if (!net) {
            throw new Error(`Model '${m.netKey}' not found in face-api.`);
          }
          if (typeof net.loadFromUri === "function") {
            await withTimeout(net.loadFromUri(MODEL_URL), 30000, `${m.label} load`);
          }
        })
      );

      globalModelsLoaded = true;
    })();

    try {
      await globalLoadingPromise;
      setModelName("");
      setReady(true);
      setProgress(100);
    } catch (err) {
      console.error("[FaceModels] Load error:", err);
      globalLoadingPromise = null;
      setError(err.message || "Failed to load face recognition models");
      setReady(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ready, progress, modelName, error };
}
