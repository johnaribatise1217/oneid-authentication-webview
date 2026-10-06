export function sendToNative(message) {
  window.ReactNativeWebView?.postMessage(JSON.stringify(message));
}
