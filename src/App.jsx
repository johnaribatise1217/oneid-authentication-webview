import { useRef, useState } from "react";
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

export default function App() {
  const faceioRef = useRef(null);
  const inProgressRef = useRef(false);

  const [phase, setPhase] = useState(appId ? "ready" : "failed");

  const [error, setError] = useState(
    appId ? null : "FaceIO is not configured for this environment.",
  );

  async function startAuthentication() {
    if (inProgressRef.current || !appId) return;

    inProgressRef.current = true;
    setError(null);
    setPhase("authenticating");

    try {
      // Initialize FACEIO only after the user clicks the button.
      // Do not run a separate getUserMedia camera pre-check.
      if (!faceioRef.current) {
        faceioRef.current = new faceIO(appId);
      }

      // FACEIO handles camera access, liveness, recognition
      // and PIN verification internally.
      const userData = await faceioRef.current.authenticate({
        locale: "auto",
      });

      setPhase("completed");

      // Send successful authentication data to React Native.
      sendToNative({
        type: "FACEIO_AUTHENTICATION_COMPLETED",
        succeed: true,
        data: userData,
        message: "Face authenticated successfully.",
      });
    } catch (errorCode) {
      console.error("FACEIO authentication failed:", errorCode);

      const message =
        typeof errorCode === "number" && faceioRef.current
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

  // FACEIO owns the visual experience during authentication.
  if (phase === "authenticating") {
    return <main className="faceio-stage" aria-busy="true" />;
  }

  return (
    <main className="page-shell">
      <section className="authentication-card" aria-live="polite">
        <span className="eyebrow">ONEID</span>

        <h1>Confirm Face ID</h1>

        {phase === "ready" && (
          <>
            <p>
              Verify your identity using your enrolled face. You may also be
              asked to enter your FaceIO PIN.
            </p>

            <button type="button" onClick={startAuthentication}>
              Start Face ID Authentication
            </button>
          </>
        )}

        {phase === "completed" && <p>Face verified. Returning to the app...</p>}

        {phase === "failed" && (
          <>
            <p className="error">{error}</p>

            {appId && (
              <button type="button" onClick={tryAgain}>
                Try again
              </button>
            )}
          </>
        )}
      </section>
    </main>
  );
}
