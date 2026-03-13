import "./Game.css";
import { useParams } from "react-router-dom";
import { getGameById } from "../services/gameService.ts";
import { useEffect, useState } from "react";
import type { GameInfo } from "@gamenite/shared";
import ChatPanel from "../components/ChatPanel.tsx";
import GamePanel from "../components/GamePanel.tsx";
import useAuth from "../hooks/useAuth.ts";
import { sendInviteRequest } from "../services/inviteService.ts";

export default function Game() {
  const { gameId } = useParams();
  const [game, setGame] = useState<GameInfo | null>(null);
  const [inviteeUsername, setInviteeUsername] = useState("");
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [sendingInvite, setSendingInvite] = useState(false);
  const auth = useAuth();

  useEffect(() => {
    let ignore = false;
    (async () => {
      const loadedGame = await getGameById(gameId!);
      if (ignore || "error" in loadedGame) return;
      setGame(loadedGame);
    })();
    return () => {
      ignore = true;
    };
  }, [gameId]);

  const handleSendInvite = async () => {
    if (!game) return;

    const trimmedUsername = inviteeUsername.trim();
    if (trimmedUsername === "") {
      setInviteErr("Please enter a username");
      setInviteMsg(null);
      return;
    }

    setSendingInvite(true);
    setInviteErr(null);
    setInviteMsg(null);

    const response = await sendInviteRequest(auth, game.gameId, trimmedUsername);

    if ("error" in response) {
      setInviteErr(response.error);
      setInviteMsg(null);
      setSendingInvite(false);
      return;
    }

    setInviteMsg(`Invite sent to ${trimmedUsername}`);
    setInviteErr(null);
    setInviteeUsername("");
    setSendingInvite(false);
  };

  const showInvitePanel =
    game !== null && game.status === "waiting" && game.createdBy.username === auth.username;

  return (
    game && (
      <>
        {showInvitePanel && (
          <div className="content spacedSection">
            <h3>Invite player</h3>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                className="widefill notTooWide"
                type="text"
                placeholder="Enter username"
                value={inviteeUsername}
                onChange={(e) => setInviteeUsername(e.target.value)}
              />
              <button
                type="button"
                className="primary narrow"
                onClick={handleSendInvite}
                disabled={sendingInvite}
              >
                {sendingInvite ? "Sending..." : "Send Invite"}
              </button>
            </div>
            {inviteMsg && <p>{inviteMsg}</p>}
            {inviteErr && <p className="error-message">{inviteErr}</p>}
          </div>
        )}

        <div className="gameContainer">
          <GamePanel {...game} />
          <ChatPanel chatId={game.chat} />
        </div>
      </>
    )
  );
}
