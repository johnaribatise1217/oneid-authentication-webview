import { createRoot } from "react-dom/client";
import App from "./App";

// Do not use React StrictMode here. In development, it invokes effects twice,
// which can cause the FaceIO npm package to inject fio.js more than once.
createRoot(document.getElementById("root")).render(<App />);
