import { useEffect, useRef, useState } from "react";
import useLoginContext from "../hooks/useLoginContext";
import useTimeSince from "../hooks/useTimeSince";
import useEditProfileForm from "../hooks/useEditProfileForm";
import { PROFILE_PHOTO_MAX_BYTES } from "@gamenite/shared";
import { DEFAULT_PROFILE_PHOTO_SRC, getProfilePhotoSrc } from "../util/profilePhoto.ts";

const DEFAULT_PROFILE_PHOTO_FILE_NAME = "default-profile.png";

async function dataUrlToFile(dataUrl: string, fileName: string): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type || "image/png" });
}

export default function UpdateProfile() {
  const { user } = useLoginContext();
  const timeSince = useTimeSince();
  const [showPass, setShowPass] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    display,
    setDisplay,
    password,
    setPassword,
    confirm,
    setConfirm,
    bio,
    setBio,
    err,
    handleSubmit,
    photoFile,
    photoPreviewUrl,
    selectPhoto,
    resetSelectedPhoto,
    success,
  } = useEditProfileForm();

  useEffect(() => {
    if (!photoFile && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [photoFile]);

  const currentPhotoSrc = getProfilePhotoSrc(user.profilePhoto);
  const profilePhotoSrc = photoPreviewUrl ?? currentPhotoSrc;
  const isPreviewingPendingPhoto = photoPreviewUrl !== null;

  return (
    <form className="content spacedSection" onSubmit={handleSubmit}>
      <h2>Profile</h2>
      <div>
        <h3>General information</h3>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
          <div style={{ flexShrink: 0 }}>
            <img
              src={profilePhotoSrc}
              alt={`${user.display}'s profile`}
              onError={(e) => {
                e.currentTarget.src = DEFAULT_PROFILE_PHOTO_SRC;
              }}
              style={{
                width: "96px",
                height: "96px",
                objectFit: "cover",
                borderRadius: "50%",
                border: "1px solid #ccc",
                flexShrink: 0,
                backgroundColor: "#9ca3af",
              }}
            />
            <div className="smallAndGray" style={{ marginTop: "0.5rem" }}>
              {isPreviewingPendingPhoto ? "Previewing selected photo" : "Current saved photo"}
            </div>
          </div>
          <div className="spacedSection">
            <ul>
              <li>Username: {user.username}</li>
              <li>Account created {timeSince(user.createdAt)}</li>
              {user.bio && <li>Bio: {user.bio}</li>}
            </ul>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: "none" }}
              onChange={(e) => {
                const selectedFile = e.currentTarget.files?.[0] ?? null;
                selectPhoto(selectedFile);
              }}
            />

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="secondary narrow"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload Photo
              </button>

              <button
                type="button"
                className="secondary narrow"
                disabled={!photoFile}
                onClick={() => {
                  resetSelectedPhoto();
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                Clear selection
              </button>

              <button
                type="button"
                className="secondary narrow"
                onClick={async () => {
                  const defaultPhotoFile = await dataUrlToFile(
                    DEFAULT_PROFILE_PHOTO_SRC,
                    DEFAULT_PROFILE_PHOTO_FILE_NAME,
                  );
                  selectPhoto(defaultPhotoFile);
                }}
              >
                Use default photo
              </button>
            </div>

            <div className="smallAndGray">
              PNG, JPEG, or WEBP up to {Math.floor(PROFILE_PHOTO_MAX_BYTES / (1024 * 1024))} MB
            </div>

            {photoFile ? (
              <div className="smallAndGray">Selected: {photoFile.name}</div>
            ) : (
              <div className="smallAndGray">Changes are saved when you submit the form.</div>
            )}
          </div>
        </div>
      </div>
      <hr />
      <div className="spacedSection">
        <h3>Display name</h3>
        <div style={{ display: "flex", flexDirection: "row", gap: "0.5rem" }}>
          <input
            className="widefill notTooWide"
            value={display}
            onChange={(e) => setDisplay(e.target.value)}
          />
          <button
            className="secondary narrow"
            onClick={(e) => {
              e.preventDefault();
              setDisplay(user.display);
            }}
          >
            Reset
          </button>
        </div>
      </div>
      <hr />
      <div className="spacedSection">
        <h3>Bio</h3>
        <div style={{ display: "flex", flexDirection: "row", gap: "0.5rem" }}>
          <textarea
            className="widefill notTooWide"
            placeholder="Write something about yourself..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
          <button
            className="secondary narrow"
            onClick={(e) => {
              e.preventDefault();
              setBio(user.bio ?? "");
            }}
          >
            Reset
          </button>
        </div>
      </div>
      <hr />
      <div className="spacedSection">
        <h3>Reset password</h3>
        <div style={{ display: "flex", flexDirection: "row", gap: "0.5rem" }}>
          <input
            type={showPass ? "input" : "password"}
            className="widefill notTooWide"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            className="secondary narrow"
            onClick={(e) => {
              e.preventDefault();
              setPassword("");
              setConfirm("");
            }}
          >
            Reset
          </button>
          <button
            className="secondary narrow"
            aria-label="Toggle show password"
            onClick={(e) => {
              e.preventDefault();
              setShowPass((v) => !v);
            }}
          >
            {showPass ? "Hide" : "Reveal"}
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "row", gap: "0.5rem" }}>
          <input
            type={showPass ? "input" : "password"}
            className="widefill notTooWide"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
      </div>
      <hr />
      {err && <p className="error-message">{err}</p>}
      {success && <p style={{ color: "green", fontSize: "14px" }}>{success}</p>}
      <div>
        <button className="primary narrow">Submit</button>
      </div>
      <div className="smallAndGray">After updating your profile, you will be logged out</div>
    </form>
  );
}
