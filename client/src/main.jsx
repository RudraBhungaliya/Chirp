import React from "react";
import ReactDOM from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";

import App from "./App";
import { AuthProvider } from "./context/authContext";
import { SocketProvider } from "./context/socketContext";
import "./index.css";

const googleClientId =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "dev-dummy-client-id.apps.googleusercontent.com";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <SocketProvider>
          <App />
        </SocketProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
