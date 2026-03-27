import type { SafeUserInfo } from "@gamenite/shared";
import { useEffect, useState } from "react";
import useTimeSince from "../hooks/useTimeSince";
import { getUserById } from "../services/userService";

interface ViewProfileProps {
  username: string;
}

const DEFAULT_PROFILE_PHOTO_SRC =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAHklEQVR4nO3BMQEAAADCoPdPbQ43oAAAAAAAAAAA4G8G2wAB9v0ZVwAAAABJRU5ErkJggg==";

export default function ViewProfile({ username }: ViewProfileProps) {
  const [componentState, setComponentState] = useState<
    { type: "waiting" } | { type: "error"; msg: string } | { type: "profile"; user: SafeUserInfo }
  >({ type: "waiting" });
  const timeSince = useTimeSince();

  useEffect(() => {
    let cancel = false;

    getUserById(username)
      .then((response) => {
        if (cancel) return;
        if ("error" in response) {
          setComponentState({ type: "error", msg: response.error });
        } else {
          setComponentState({ type: "profile", user: response });
        }
      })
      .catch((err) => {
        if (cancel) return;
        setComponentState({ type: "error", msg: `${err}` });
      });

    return () => {
      cancel = true;
    };
  }, [username]);

  switch (componentState.type) {
    case "error":
      return <div style={{ color: "#f00" }}>{componentState.msg}</div>;
    case "waiting":
      return <div>Loading...</div>;
    case "profile": {
      const { user } = componentState;
      const profilePhotoSrc = user.profilePhoto
        ? `data:${user.profilePhoto.mimeType};base64,${user.profilePhoto.dataBase64}`
        : DEFAULT_PROFILE_PHOTO_SRC;

      return (
        <>
          <h2>Profile for {user.display}</h2>
          <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
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
                backgroundColor: "#9ca3af",
                flexShrink: 0,
              }}
            />
            <div>
              <ul>
                <li>Username: {user.username}</li>
                <li>Account created {timeSince(user.createdAt)}</li>
                {user.bio && <li>Bio: {user.bio}</li>}
              </ul>
            </div>
          </div>
        </>
      );
    }
  }
}
