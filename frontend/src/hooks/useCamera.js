import { useState, useRef, useCallback, useEffect } from "react";

export default function useCamera({ facingMode = "user" } = {}) {
  const [stream, setStream] = useState(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const onTrackEnded = useCallback(() => {
    setError("Camera disconnected. Please reconnect and restart.");
    setActive(false);
    streamRef.current = null;
    setStream(null);
  }, []);

  const start = useCallback(async (facing) => {
    try {
      setError(null);
      const mode = facing || facingMode;
      let s;

      try {
        s = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: mode ? { ideal: mode } : undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        s = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      }

      s.getTracks().forEach((t) => {
        t.addEventListener("ended", onTrackEnded);
      });

      streamRef.current = s;
      setStream(s);

      if (videoRef.current) {
        videoRef.current.srcObject = s;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          if (playErr.name === "NotAllowedError") {
            setError("Camera autoplay blocked by browser. Tap the video or allow autoplay.");
          } else {
            setError("Camera play failed: " + playErr.message);
          }
          // Don't set active — camera isn't usable
          s.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          setStream(null);
          return;
        }
        setActive(true);
      } else {
        setActive(true);
      }
    } catch (err) {
      setError(err.message || "Camera access denied");
      setActive(false);
    }
  }, [facingMode]);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setActive(false);
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return { videoRef, stream, active, error, start, stop };
}
