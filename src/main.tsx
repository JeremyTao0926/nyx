import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

const root = document.getElementById("root")!;

async function bootstrap() {
  if (window.location.pathname.startsWith("/admin")) {
    const { AdminApp } = await import("./admin/AdminApp");
    ReactDOM.createRoot(root).render(<StrictMode><AdminApp /></StrictMode>);
    return;
  }
  const { default: App } = await import("./App");
  ReactDOM.createRoot(root).render(<StrictMode><App /></StrictMode>);
}

void bootstrap();
