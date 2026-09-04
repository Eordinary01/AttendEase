const CDN_URL = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights";

let scriptLoaded = false;
let scriptPromise = null;

function waitForScript(timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    if (window.faceapi) {
      scriptLoaded = true;
      resolve(window.faceapi);
      return;
    }

    const existing = document.querySelector('script[src*="face-api.min.js"]');
    if (existing) {
      if (existing.readyState === "complete" || existing.readyState === "loaded") {
        if (window.faceapi) {
          scriptLoaded = true;
          resolve(window.faceapi);
          return;
        }
      }
      existing.addEventListener("load", () => {
        if (window.faceapi) {
          scriptLoaded = true;
          resolve(window.faceapi);
        } else {
          reject(new Error("face-api.js loaded but window.faceapi is undefined"));
        }
      });
      existing.addEventListener("error", () => {
        reject(new Error("Failed to load face-api.js from CDN"));
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/dist/face-api.min.js";
    script.crossOrigin = "anonymous";
    script.async = true;

    const timer = setTimeout(() => {
      reject(new Error("face-api.js script load timed out after " + timeoutMs + "ms"));
    }, timeoutMs);

    script.onload = () => {
      clearTimeout(timer);
      if (window.faceapi) {
        scriptLoaded = true;
        resolve(window.faceapi);
      } else {
        reject(new Error("face-api.js loaded but window.faceapi is undefined"));
      }
    };
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Failed to load face-api.js from CDN — check your network connection"));
    };
    document.head.appendChild(script);
  });
}

export function loadFaceApiScript() {
  if (scriptLoaded && window.faceapi) return Promise.resolve(window.faceapi);
  if (scriptPromise) return scriptPromise;

  scriptPromise = waitForScript();
  return scriptPromise;
}

export function getWeightsUrl() {
  return CDN_URL;
}

export function isFaceApiLoaded() {
  return scriptLoaded && !!window.faceapi;
}
