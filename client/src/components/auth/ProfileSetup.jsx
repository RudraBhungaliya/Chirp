import { useState, useRef } from "react";
import { Camera, X, User, AlertCircle } from "lucide-react";
import { useAuth } from "../../context/authContext";

export default function ProfileSetup({
  isModal = false,
  onClose = null,
  onProfileUpdate = null,
}) {
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

    if (file.size > 500 * 1024) {
      setError("Avatar must be under 500KB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (PNG, JPG)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result;
      setForm((prev) => ({ ...prev, avatar: base64 }));
      setAvatarPreview(base64);
      setError("");
    };
    reader.onerror = () => {
      setError("Failed to read file");
    };
    reader.readAsDataURL(file);
  };

  const submit = async (e) => {
    e?.preventDefault();
    if (!form.userName.trim() || !form.displayName.trim()) {
      setError("Username and display name are required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const endpoint = isModal
        ? "/api/users/profile"
        : "/api/users/complete-profile";
      const method = isModal ? "PUT" : "POST";

      const API_URL = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userName: form.userName.trim(),
          displayName: form.displayName.trim(),
          bio: form.bio.trim(),
          ...(form.avatar && { avatar: form.avatar }),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        setError(errorData.msg || "Profile update failed");
        return;
      }

      const updatedUser = await res.json();

      login({
        token,
        user: updatedUser,
      });

      if (onProfileUpdate) {
        onProfileUpdate(updatedUser);
      }

      if (isModal && onClose) {
        onClose();
      }
    } catch (err) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-[#222E35] rounded-xl shadow-2xl border border-[#2A3942] w-full max-w-sm p-6 text-[#E9EDEF]">
        {/* HEADER */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2A3942] mb-5">
          <h2 className="text-base font-medium text-[#E9EDEF]">
            {isModal ? "Profile" : "Complete your profile"}
          </h2>
          {isModal && onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-full text-[#8696A0] hover:text-[#E9EDEF] hover:bg-[#202C33] transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {/* AVATAR UPLOAD */}
          <div className="flex flex-col items-center">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative w-24 h-24 rounded-full overflow-hidden bg-[#202C33] border-2 border-[#374248] cursor-pointer group shadow"
            >
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = "/default-avatar.jpeg";
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#8696A0]">
                  <User className="w-10 h-10" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs text-center p-1">
                <Camera className="w-5 h-5 mb-1" />
                <span>Change Photo</span>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              hidden
            />
          </div>

          {/* INPUTS */}
          <div>
            <label className="block text-xs text-[#00A884] font-medium mb-1">
              Your name
            </label>
            <input
              type="text"
              placeholder="Display name"
              value={form.displayName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, displayName: e.target.value }))
              }
              className="w-full h-10 px-3 text-sm bg-[#2A3942] rounded-md text-[#E9EDEF] placeholder:text-[#8696A0] outline-none border-b-2 border-transparent focus:border-[#00A884] transition"
            />
          </div>

          <div>
            <label className="block text-xs text-[#00A884] font-medium mb-1">
              Username
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-sm text-[#8696A0]">@</span>
              <input
                type="text"
                placeholder="username"
                value={form.userName}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    userName: e.target.value.toLowerCase().replace(/\s+/g, ""),
                  }))
                }
                className="w-full h-10 pl-7 pr-3 text-sm bg-[#2A3942] rounded-md text-[#E9EDEF] placeholder:text-[#8696A0] outline-none border-b-2 border-transparent focus:border-[#00A884] transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#00A884] font-medium mb-1">
              About
            </label>
            <textarea
              rows={2}
              placeholder="Hey there! I am using Chirp."
              value={form.bio}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, bio: e.target.value }))
              }
              className="w-full p-2.5 text-sm bg-[#2A3942] rounded-md text-[#E9EDEF] placeholder:text-[#8696A0] outline-none border-b-2 border-transparent focus:border-[#00A884] transition resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2 rounded bg-red-950/40 border border-red-900/60 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ACTIONS */}
          <div className="flex items-center gap-2 pt-2">
            {isModal && onClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 h-9 px-3 text-xs font-semibold text-[#8696A0] hover:text-[#E9EDEF] hover:bg-[#202C33] rounded transition cursor-pointer"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-10 px-4 text-xs font-bold text-[#111B21] bg-[#00A884] hover:bg-[#06cf9c] rounded shadow transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
