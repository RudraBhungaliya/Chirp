import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../../context/authContext";

export default function GoogleLoginButton() {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const API_URL = import.meta.env.VITE_API_URL || "";
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const hasValidGoogleId =
    clientId &&
    clientId.trim() !== "" &&
    clientId !== "dummy" &&
    clientId !== "your_google_oauth_client_id" &&
    !clientId.startsWith("dev-dummy");

  const handleSuccess = async (credentialResponse) => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API_URL}/api/auth/google`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          credential: credentialResponse.credential,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.msg || "Google authentication failed");
        return;
      }

      const data = await res.json();
      login(data);
    } catch (err) {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = async (name) => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API_URL}/api/auth/dev-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name || "Dev User",
          email: `${(name || "dev").toLowerCase().replace(/\s+/g, "")}@chirp.local`,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.msg || "Dev login failed");
        return;
      }

      const data = await res.json();
      login(data);
    } catch (err) {
      setError("Failed to connect to backend server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-[280px]">
      {hasValidGoogleId ? (
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => setError("Google Sign-In failed")}
        />
      ) : (
        <p className="text-xs text-amber-400 text-center">
          Google OAuth Client ID not configured in .env. Use Quick Sign-In below:
        </p>
      )}

      <div className="w-full flex flex-col gap-2 pt-2 border-t border-gray-700">
        <p className="text-xs text-gray-400 text-center">Quick Dev / Guest Sign-In:</p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleDevLogin("Alice Smith")}
            className="flex-1 py-2 px-3 bg-[#00A884] hover:bg-[#008f6f] text-white text-xs font-medium rounded transition disabled:opacity-50 cursor-pointer"
          >
            Sign in as Alice
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleDevLogin("Bob Jones")}
            className="flex-1 py-2 px-3 bg-[#202C33] hover:bg-[#2A3942] text-white text-xs font-medium rounded border border-gray-600 transition disabled:opacity-50 cursor-pointer"
          >
            Sign in as Bob
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-xs mt-1 text-center">{error}</p>}
      {loading && <p className="text-gray-400 text-xs text-center">Authenticating...</p>}
    </div>
  );
}
