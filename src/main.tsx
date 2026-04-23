import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./style.css";

const root = document.querySelector<HTMLDivElement>("#app")!;

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
