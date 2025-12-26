import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../../context/authContext";

export default function GoogleLoginButton() {
  const { login } = useAuth();

  const handleSuccess = async (credentialResponse) => {
    const res = await fetch("http://localhost:5000/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: credentialResponse.credential }),
    });

    const data = await res.json();
    login(data);
  };

  return <GoogleLogin onSuccess={handleSuccess} />;
}
