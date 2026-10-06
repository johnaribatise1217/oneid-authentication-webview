# OneID Face Authentication WebView

This is a company-owned, JavaScript-only React page for FACEIO authentication inside the existing React Native `WebView`.

It does not receive a user context from React Native. FACEIO identifies the face from its facial index and returns the payload saved during enrollment. That payload includes `email` and `whoami`, which keeps it compatible with the existing `useFaceVerification` hook.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev -- --host 0.0.0.0
```

Set `VITE_FACEIO_APP_ID` to the public FACEIO application ID for the current environment. Enrollment and authentication must use the same FACEIO public app ID in the same environment.

Use an HTTPS deployment for testing on a physical device. Add the deployed domain to the FACEIO allowed origins list.

## React Native contract

The page sends a result compatible with the existing native handler:

```js
// Success
{
  type: "FACEIO_AUTHENTICATION_COMPLETED",
  succeed: true,
  data: {
    facialId: "faceio-uuid",
    payload: {
      email: "staff@example.com",
      whoami: "staff-verification-code"
    }
  },
  message: "Face authenticated successfully."
}

// Failure
{
  type: "FACEIO_AUTHENTICATION_FAILED",
  succeed: false,
  data: null,
  message: "Human-readable error message"
}
```

Your current `useFaceVerification` hook can continue to compare:

```js
result.data?.payload?.email
result.data?.payload?.whoami
```

## Security boundary

- This project uses only the FACEIO public app ID.
- Never add a FACEIO REST API key, webhook token, NIN, BVN, password, or access token to this web app or a FACEIO payload.
- The current native comparison is compatible with this bridge. For production hardening, send the successful `facialId` to the backend and validate the user-to-face mapping server-side before issuing an application session.
