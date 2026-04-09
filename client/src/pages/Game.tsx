import "./Game.css";
import { useParams } from "react-router-dom";
import { getGameById } from "../services/gameService.ts";
import { useCallback, useEffect, useState } from "react";
import type { GameInfo, InviteInfo } from "@gamenite/shared";
import ChatPanel from "../components/ChatPanel.tsx";
import GamePanel from "../components/GamePanel.tsx";
import useAuth from "../hooks/useAuth.ts";
import useLoginContext from "../hooks/useLoginContext.ts";
import {
  cancelInviteRequest,
  getSentInvites,
  sendInviteRequest,
} from "../services/inviteService.ts";

export default function Game() {
  const { gameId } = useParams();
  const [game, setGame] = useState<GameInfo | null>(null);
  const [inviteeUsername, setInviteeUsername] = useState("");
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [sentInvites, setSentInvites] = useState<InviteInfo[]>([]);
  const [sentInviteErr, setSentInviteErr] = useState<string | null>(null);
  const [loadingSentInvites, setLoadingSentInvites] = useState(false);
  const [cancelingInviteId, setCancelingInviteId] = useState<string | null>(null);
  const auth = useAuth();
  const { socket } = useLoginContext();

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

  const refreshSentInvites = useCallback(
    async (roomId: string) => {
      setLoadingSentInvites(true);
      const response = await getSentInvites(auth, false);

      if ("error" in response) {
        setSentInviteErr(response.error);
        setSentInvites([]);
        setLoadingSentInvites(false);
        return;
      }

      setSentInviteErr(null);
      setSentInvites(response.filter((invite) => invite.roomId === roomId));
      setLoadingSentInvites(false);
    },
    [auth],
  );

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
    await refreshSentInvites(game.gameId);
  };

  const handleCancelInvite = async (inviteId: string) => {
    if (!game) return;

    setCancelingInviteId(inviteId);
    setSentInviteErr(null);
    const response = await cancelInviteRequest(auth, inviteId);

    if ("error" in response) {
      setSentInviteErr(response.error);
      setCancelingInviteId(null);
      await refreshSentInvites(game.gameId);
      return;
    }

    setCancelingInviteId(null);
    await refreshSentInvites(game.gameId);
  };

  const showInvitePanel =
    game !== null && game.status === "waiting" && game.createdBy.username === auth.username;

  useEffect(() => {
    if (!showInvitePanel || !game) return;
    const refreshTimeout = setTimeout(() => {
      void refreshSentInvites(game.gameId);
    }, 0);
    return () => {
      clearTimeout(refreshTimeout);
    };
  }, [game, refreshSentInvites, showInvitePanel]);

  useEffect(() => {
    if (!showInvitePanel || !game) return;
    const handleStatusUpdate = (invite: InviteInfo) => {
      if (invite.roomId === game.gameId) {
        setSentInvites((prev) => prev.filter((i) => i.inviteId !== invite.inviteId));
      }
    };
    socket.on("inviteStatusUpdated", handleStatusUpdate);
    return () => {
      socket.off("inviteStatusUpdated", handleStatusUpdate);
    };
  }, [socket, showInvitePanel, game]);

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
            <div className="spacedSection">
              <h4>Sent invites</h4>
              {loadingSentInvites ? (
                <div>Loading sent invites...</div>
              ) : sentInviteErr ? (
                <div className="error-message">{sentInviteErr}</div>
              ) : sentInvites.length === 0 ? (
                <div>No invites sent for this room</div>
              ) : (
                <div className="dottedList">
                  {sentInvites.map((invite) => (
                    <div className="dottedListItem" key={invite.inviteId}>
                      <strong>{invite.inviteeUsername}</strong> - {invite.status}
                      {invite.status === "pending" ? (
                        <>
                          {" "}
                          (expires {invite.expiresAt.toLocaleTimeString()})
                          <button
                            type="button"
                            className="secondary narrow"
                            style={{ marginLeft: "0.5rem" }}
                            disabled={cancelingInviteId === invite.inviteId}
                            onClick={() => handleCancelInvite(invite.inviteId)}
                          >
                            {cancelingInviteId === invite.inviteId ? "Canceling..." : "Cancel"}
                          </button>
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
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
