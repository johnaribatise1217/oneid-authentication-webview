import { useEffect, useRef, useState } from "react";
import faceIO from "@faceio/fiojs";
import { sendToNative } from "./messages";
import "./app.css";

const appId = import.meta.env.FACEIO_APP_ID;

const sleep = (milliseconds) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function waitForFaceIoWidget(timeoutMilliseconds = 12_000) {
  const startedAt = Date.now();

  while (typeof window.faceIO !== "function") {
    if (Date.now() - startedAt >= timeoutMilliseconds) {
      throw new Error("FACEIO_WIDGET_TIMEOUT");
    }

    await sleep(50);
  }

  // fio.js has loaded. Give the npm wrapper's load handler a moment to create
  // its internal client before authenticate() is called.
  await sleep(100);
}

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

function startupErrorMessage(error) {
  if (error?.message === "FACEIO_WIDGET_TIMEOUT") {
    return "FaceIO could not start. Check the connection and try again.";
  }

  return "Face verification could not be started. Please try again.";
}

export default function App() {
  const faceioRef = useRef(null);
  const startAttemptedRef = useRef(false);
  const [phase, setPhase] = useState("starting");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!appId) {
      setError("FaceIO is not configured for this environment.");
      setPhase("failed");
      return undefined;
    }

    faceioRef.current = new faceIO(appId);
    let cancelled = false;

    async function beginAuthentication() {
      if (startAttemptedRef.current) return;
      startAttemptedRef.current = true;

      try {
        await waitForFaceIoWidget();

        if (cancelled) return;

        setPhase("authenticating");

        // No email or whoami is supplied here. FaceIO returns the payload that
        // was saved during enrollment, including email and whoami.
        const userData = await faceioRef.current.authenticate({
          locale: "auto",
        });

        if (cancelled) return;

        setPhase("completed");
        sendToNative({
          type: "FACEIO_AUTHENTICATION_COMPLETED",
          succeed: true,
          data: userData,
          message: "Face authenticated successfully.",
        });
      } catch (errorCode) {
        if (cancelled) return;

        const message =
          typeof errorCode === "number"
            ? errorMessage(errorCode, faceioRef.current)
            : startupErrorMessage(errorCode);

        setError(message);
        setPhase("failed");
        sendToNative({
          type: "FACEIO_AUTHENTICATION_FAILED",
          succeed: false,
          data: null,
          message,
        });
      }
    }

    beginAuthentication();

    return () => {
      cancelled = true;
    };
  }, []);

  function tryAgain() {
    // Start with a clean FACEIO page/session after a failed or aborted attempt.
    window.location.reload();
  }

  // Once authenticate() starts, the FACEIO widget owns the camera, liveness,
  // and PIN experience. Do not add another getUserMedia preflight here.
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

        {phase === "completed" && <p>Face verified. Returning to the app...</p>}

        {phase === "failed" && (
          <>
            <p className="error">{error}</p>
            <button onClick={tryAgain}>Try again</button>
          </>
        )}
      </section>
    </main>
  );
}
