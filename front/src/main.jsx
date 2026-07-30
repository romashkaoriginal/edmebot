import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "./router";
import "./index.css";
import App from "./App.jsx";
import { AppProvider } from "./store/AppStore";
import { initTelegramWebApp } from "./api/admin";
import ErrorBoundary from "./components/ErrorBoundary";

initTelegramWebApp();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <App />
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
