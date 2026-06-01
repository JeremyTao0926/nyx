import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AdminApp } from "./admin/AdminApp";

const root = document.getElementById("root")!;

// Route to admin panel if URL starts with /admin
if (window.location.pathname.startsWith("/admin")) {
  ReactDOM.createRoot(root).render(<StrictMode><AdminApp /></StrictMode>);
} else {
  ReactDOM.createRoot(root).render(<StrictMode><App /></StrictMode>);
}
