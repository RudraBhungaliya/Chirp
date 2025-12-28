import { useState, useRef } from "react";
import { useAuth } from "../../context/authContext";

export default function ProfileSetup({ isModal = false, onClose = null, onProfileUpdate = null }) {
  const { token, user, login } = useAuth();

  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    userName: user?.userName || "",
    displayName: user?.displayName || "",
    bio: user?.bio || "",
    avatar: null,
  });

  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Avatar must be less than 5MB");
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result;
      setForm({ ...form, avatar: base64 });
      setAvatarPreview(base64);
      setError("");
    };
    reader.onerror = () => {
      setError("Failed to read file");
    };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!form.userName || !form.displayName) {
      setError("Username and display name are required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const endpoint = isModal ? "/api/users/profile" : "/api/users/complete-profile";
      const method = isModal ? "PUT" : "POST";

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}${endpoint}`,
        {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userName: form.userName,
            displayName: form.displayName,
            bio: form.bio,
            ...(form.avatar && { avatar: form.avatar }),
          }),
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

      if (isModal && onProfileUpdate) {
        onProfileUpdate(updatedUser);
      } else if (!isModal && onProfileUpdate) {
        onProfileUpdate(updatedUser);
      }

      if (isModal && onClose) {
        onClose();
      }
    } catch (err) {
      setError(err.message || "An error occurred");
      console.error("Profile setup error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (isModal) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-[#111B21] p-6 rounded w-[320px] max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white">Edit profile</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-xl"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col items-center mb-4">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-[#2A3942] flex items-center justify-center mb-3">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="avatar preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl">👤</span>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              Change Photo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              hidden
            />
          </div>

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

          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-gray-700 py-2 text-white rounded disabled:bg-gray-800 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={loading}
              className="flex-1 bg-green-600 py-2 text-white rounded disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[#111B21] p-6 rounded w-[320px] max-h-[90vh] overflow-y-auto">
        <h2 className="text-white mb-4">Complete your profile</h2>

        <div className="flex flex-col items-center mb-4">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-[#2A3942] flex items-center justify-center mb-3">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="avatar preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-3xl">👤</span>
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            Add Photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            hidden
          />
        </div>

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
