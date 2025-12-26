import { useState } from "react";
import { useAuth } from "../../context/authContext";

export default function ProfileSetup() {
  const { token, login } = useAuth();
  const [form, setForm] = useState({
    userName: "",
    displayName: "",
    bio: "",
  });

  const submit = async () => {
    const res = await fetch(
      "http://localhost:5000/api/users/complete-profile",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      }
    );

    const user = await res.json();
    login({ token, user, needsProfile: false });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
      <div className="bg-[#111B21] p-6 rounded w-[320px]">
        <h2 className="text-white mb-4">Complete your profile</h2>

        <input
          placeholder="Username"
          onChange={(e) => setForm({ ...form, userName: e.target.value })}
          className="w-full mb-2 p-2 bg-[#202C33]"
        />
        <input
          placeholder="Display name"
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          className="w-full mb-2 p-2 bg-[#202C33]"
        />
        <textarea
          placeholder="Bio"
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          className="w-full mb-3 p-2 bg-[#202C33]"
        />

        <button onClick={submit} className="w-full bg-green-600 py-2">
          Continue
        </button>
      </div>
    </div>
  );
}
