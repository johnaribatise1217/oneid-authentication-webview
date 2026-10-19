import { useEffect, useRef, useState } from "react";
import faceIO from "@faceio/fiojs";
import { sendToNative } from "./messages";
import "./app.css";

const appId = import.meta.env.VITE_FACEIO_APP_ID;

function errorMessage(errorCode, faceio) {
  const codes = faceio.fetchAllErrorCodes();

  const messages = new Map([
    [
      codes.PERMISSION_REFUSED,
      "Camera access was denied. Enable it and try again.",
    ],
    [
      codes.NO_FACES_DETECTED,
      "No face was detected. Look at the camera and try again.",
    ],
    [codes.UNRECOGNIZED_FACE, "This face is not enrolled on OneID."],
    [codes.MANY_FACES, "More than one face was detected. Continue alone."],
    [
      codes.PAD_ATTACK,
      "Face verification could not confirm a live person. Please try again.",
    ],
    [codes.FACE_MISMATCH, "The camera frames did not match. Please try again."],
    [codes.WRONG_PIN_CODE, "The FaceIO PIN entered was incorrect."],
    [
      codes.PROCESSING_ERR,
      "Face verification could not be processed. Please try again.",
    ],
    [
      codes.UNAUTHORIZED,
      "Face verification is not authorised for this application.",
    ],
    [
      codes.TERMS_NOT_ACCEPTED,
      "Face verification was cancelled because consent was not accepted.",
    ],
    [
      codes.SESSION_EXPIRED,
      "The face verification session expired. Please try again.",
    ],
    [codes.TIMEOUT, "Face verification timed out. Please try again."],
    [
      codes.TOO_MANY_REQUESTS,
      "Too many face verification attempts. Please wait and try again.",
    ],
    [codes.EMPTY_ORIGIN, "The verification page has no valid origin."],
    [
      codes.FORBIDDEN_ORIGIN,
      "This verification page is not authorised in FaceIO.",
    ],
    [codes.FORBIDDEN_COUNTRY, "FaceIO is not available from this location."],
    [
      codes.SESSION_IN_PROGRESS,
      "A face verification session is already in progress.",
    ],
    [codes.ABORTED_BY_USER, "Face verification was cancelled."],
    [codes.NETWORK_IO, "A network error occurred while connecting to FaceIO."],
  ]);

  return (
    messages.get(errorCode) ??
    "Face verification could not be completed. Please try again."
  );
}

function cameraErrorMessage(error) {
  if (error?.message === "INSECURE_CONTEXT") {
    return "Camera access requires the verification page to use HTTPS.";
  }

  if (error?.message === "CAMERA_API_UNAVAILABLE") {
    return "This WebView does not support browser camera access.";
  }

  switch (error?.name) {
    case "NotAllowedError":
      return "Camera permission was denied for the verification page.";

    case "NotFoundError":
      return "No usable front camera was found.";

    case "NotReadableError":
      return "The camera is busy. Close other camera screens and try again.";

    case "OverconstrainedError":
      return "The requested camera is not available on this device.";

    default:
      return "Camera access could not be started. Please try again.";
  }
}

async function confirmFrontCameraAccess() {
  if (!window.isSecureContext) {
    throw new Error("INSECURE_CONTEXT");
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("CAMERA_API_UNAVAILABLE");
  }

  let stream;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "user" },
      },
      audio: false,
    });
  } finally {
    stream?.getTracks().forEach((track) => track.stop());
  }
}

export default function App() {
  const faceioRef = useRef(null);
  const inProgressRef = useRef(false);

  const [phase, setPhase] = useState("starting");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!appId) {
      setError("FaceIO is not configured for this environment.");
      setPhase("failed");
      return;
    }

    try {
      faceioRef.current = new faceIO(appId);
      setPhase("ready");

      sendToNative({
        type: "FACEIO_AUTHENTICATION_WEB_READY",
      });
    } catch (initializationError) {
      console.error("FACEIO initialization failed:", initializationError);

      setError("Face verification could not be initialized.");
      setPhase("failed");
    }
  }, []);

  async function startAuthentication() {
    if (!faceioRef.current || inProgressRef.current) {
      return;
    }

    inProgressRef.current = true;
    setError(null);
    setPhase("authenticating");

    // Check camera access before starting FACEIO.
    // This matches our working enrollment implementation.
    try {
      await confirmFrontCameraAccess();
    } catch (cameraError) {
      console.error("Authentication camera preflight failed:", cameraError);

      const message = cameraErrorMessage(cameraError);

      setError(message);
      setPhase("failed");
      inProgressRef.current = false;

      sendToNative({
        type: "FACEIO_AUTHENTICATION_FAILED",
        succeed: false,
        data: null,
        message,
      });

      return;
    }

    try {
      // No email or whoami is supplied here.
      // FACEIO returns the payload stored during enrollment.
      const userData = await faceioRef.current.authenticate({
        locale: "auto",
      });

      setPhase("completed");

      sendToNative({
        type: "FACEIO_AUTHENTICATION_COMPLETED",
        succeed: true,
        data: userData,
        message: "Face authenticated successfully.",
      });
    } catch (errorCode) {
      console.error("FACEIO authentication failed:", errorCode);

      const message =
        typeof errorCode === "number"
          ? errorMessage(errorCode, faceioRef.current)
          : "Face verification could not be started. Please try again.";

      setError(message);
      setPhase("failed");

      sendToNative({
        type: "FACEIO_AUTHENTICATION_FAILED",
        succeed: false,
        data: null,
        message,
      });
    } finally {
      inProgressRef.current = false;
    }
  }

  function tryAgain() {
    // Reload to reset FACEIO's internal widget/session state.
    window.location.reload();
  }

  // Once authentication starts, FACEIO owns the visual experience.
  // Hide our React card so its camera, liveness and PIN screens
  // remain unobstructed.
  if (phase === "authenticating") {
    return <main className="faceio-stage" aria-busy="true" />;
  }

  return (
    <main className="page-shell">
      <section className="authentication-card" aria-live="polite">
        <span className="eyebrow">ONEID</span>

        <h1>Confirm Face ID</h1>

        {phase === "starting" && (
          <>
            <div className="spinner" aria-hidden="true" />

            <p>Preparing secure face verification...</p>
          </>
        )}

        {phase === "ready" && (
          <>
            <p>
              Verify your identity using your enrolled face. You may also be
              asked to enter your FaceIO PIN.
            </p>

            <button type="button" onClick={startAuthentication}>
              Start face verification
            </button>
          </>
        )}

        {phase === "completed" && <p>Face verified. Returning to the app...</p>}

        {phase === "failed" && (
          <>
            <p className="error">{error}</p>

            <button type="button" onClick={tryAgain}>
              Try again
            </button>
          </>
        )}
      </section>
    </main>
  );
}
