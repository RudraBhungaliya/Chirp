import { useState } from "react";
import { useAuth } from "../../context/authContext";

export default function ProfileSetup() {
  const { token, login } = useAuth();

  const [form, setForm] = useState({
    userName: "",
    displayName: "",
    bio: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.userName || !form.displayName) {
      setError("Username and display name are required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/users/complete-profile`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(form),
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        setError(errorData.msg || "Profile setup failed");
        return;
      }

      const updatedUser = await res.json();

      login({
        token,
        user: updatedUser,
      });
    } catch (err) {
      setError(err.message || "An error occurred");
      console.error("Profile setup error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[#111B21] p-6 rounded w-[320px]">
        <h2 className="text-white mb-4">Complete your profile</h2>

        <input
          placeholder="Username"
          className="w-full mb-2 p-2 bg-[#202C33] text-white rounded"
          onChange={(e) => setForm({ ...form, userName: e.target.value })}
          value={form.userName}
          disabled={loading}
        />

        <input
          placeholder="Display name"
          className="w-full mb-2 p-2 bg-[#202C33] text-white rounded"
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          value={form.displayName}
          disabled={loading}
        />

        <textarea
          placeholder="Bio"
          className="w-full mb-3 p-2 bg-[#202C33] text-white rounded"
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          value={form.bio}
          disabled={loading}
        />

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <button
          onClick={submit}
          disabled={loading}
          className="w-full bg-green-600 py-2 text-white rounded disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          {loading ? "Setting up..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
