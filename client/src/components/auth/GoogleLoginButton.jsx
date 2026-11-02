import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../../context/authContext";

export default function GoogleLoginButton({ onLoginSuccess }) {
  const { login } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL || "";

  const handleSuccess = async (credentialResponse) => {
    try {
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
        alert(data.msg || "Google authentication failed");
        return;
      }

      const data = await res.json();
      login(data);
      onLoginSuccess?.();
    } catch (err) {
      alert("Failed to connect to authentication server");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-2">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => alert("Google Sign-In failed")}
        theme="filled_black"
        shape="rectangular"
      />
    </div>
  );
}
