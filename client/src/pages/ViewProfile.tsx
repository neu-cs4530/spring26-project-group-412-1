import type { SafeUserInfo } from "@gamenite/shared";
import { useEffect, useState } from "react";
import useTimeSince from "../hooks/useTimeSince";
import { getUserById } from "../services/userService";

interface ViewProfileProps {
  username: string;
}
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
    case "profile":
      return (
        <>
          <h2>Profile for {componentState.user.display}</h2>
          <div>
            <ul>
              <li>Username: {componentState.user.username}</li>
              <li>Account created {timeSince(componentState.user.createdAt)}</li>
              {componentState.user.bio && <li>Bio: {componentState.user.bio}</li>}
            </ul>
          </div>
        </>
      );
  }
}
