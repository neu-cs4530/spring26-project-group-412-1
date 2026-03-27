import { useState } from "react";
import useLoginContext from "../hooks/useLoginContext";
import useTimeSince from "../hooks/useTimeSince";
import useEditProfileForm from "../hooks/useEditProfileForm";

const DEFAULT_PROFILE_PHOTO_SRC =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAHklEQVR4nO3BMQEAAADCoPdPbQ43oAAAAAAAAAAA4G8G2wAB9v0ZVwAAAABJRU5ErkJggg==";

export default function UpdateProfile() {
  const { user } = useLoginContext();
  const timeSince = useTimeSince();
  const [showPass, setShowPass] = useState(false);
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
  } = useEditProfileForm();

  const profilePhotoSrc = user.profilePhoto
    ? `data:${user.profilePhoto.mimeType};base64,${user.profilePhoto.dataBase64}`
    : DEFAULT_PROFILE_PHOTO_SRC;

  return (
    <form className="content spacedSection" onSubmit={handleSubmit}>
      <h2>Profile</h2>
      <div>
        <h3>General information</h3>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
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
          <ul>
            <li>Username: {user.username}</li>
            <li>Account created {timeSince(user.createdAt)}</li>
            {user.bio && <li>Bio: {user.bio}</li>}
          </ul>
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
      <div>
        <button className="primary narrow">Submit</button>
      </div>
      <div className="smallAndGray">After updating your profile, you will be logged out</div>
    </form>
  );
}
