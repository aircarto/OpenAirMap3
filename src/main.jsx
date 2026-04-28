import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n";
import App from "./App.tsx";
import MaintenancePage from "./components/MaintenancePage.tsx";
import { featureFlags } from "./config/featureFlags.ts";
import "./index.css";

const RootComponent = featureFlags.maintenanceMode ? MaintenancePage : App;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>
);
