import { useContext, useState } from "react";
import useThreadList from "../hooks/useThreadList.ts";
import ThreadSummaryView from "../components/ThreadSummaryView.tsx";
import { useNavigate } from "react-router-dom";
import useGameList from "../hooks/useGameList.ts";
import GameSummaryView from "../components/GameSummaryView.tsx";
import useAuth from "../hooks/useAuth.ts";
import { InviteContext } from "../contexts/InviteContext.ts";
import { acceptInviteRequest, declineInviteRequest } from "../services/inviteService.ts";

export default function Home() {
  const threadList = useThreadList(4);
  const gameList = useGameList(4);
  const navigate = useNavigate();
  const auth = useAuth();

  const { invites, refreshInvites, removeInvite } = useContext(InviteContext);
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [inviteActionId, setInviteActionId] = useState<string | null>(null);

  const handleAccept = async (inviteId: string) => {
    setInviteActionId(inviteId);
    setInviteErr(null);
    removeInvite(inviteId);
    const response = await acceptInviteRequest(auth, inviteId);
    if ("error" in response) {
      await refreshInvites();
      setInviteErr(response.error);
      setInviteActionId(null);
      return;
    }
    setInviteActionId(null);
    navigate(`/game/${response.roomId}`);
  };

  const handleDecline = async (inviteId: string) => {
    setInviteActionId(inviteId);
    setInviteErr(null);
    removeInvite(inviteId);
    const response = await declineInviteRequest(auth, inviteId);
    if ("error" in response) {
      await refreshInvites();
      setInviteErr(response.error);
    }
    setInviteActionId(null);
  };

  return (
    <div className="content">
      <div className="spacedSection">
        <h2>Pending invites</h2>
        {inviteErr && <div className="error-message">{inviteErr}</div>}
        {invites.length === 0 ? (
          <div>No pending invites</div>
        ) : (
          <div className="dottedList">
            {invites.map((invite) => (
              <div key={invite.inviteId} className="spacedSection">
                <div>
                  <strong>From:</strong> {invite.inviterUsername}
                </div>
                <div>
                  <strong>Game:</strong> {invite.gameType}
                </div>
                <div>
                  <strong>Sent:</strong> {invite.createdAt.toLocaleString()}
                </div>
                <div>
                  <strong>Expires:</strong> {invite.expiresAt.toLocaleString()}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button
                    className="primary narrow"
                    onClick={() => handleAccept(invite.inviteId)}
                    disabled={inviteActionId === invite.inviteId}
                  >
                    {inviteActionId === invite.inviteId ? "Working..." : "Accept"}
                  </button>
                  <button
                    className="secondary narrow"
                    onClick={() => handleDecline(invite.inviteId)}
                    disabled={inviteActionId === invite.inviteId}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="spacedSection">
        <h2>Recent games</h2>
        {"message" in gameList ? (
          <div>{gameList.message}</div>
        ) : (
          <div id="gameList" className="dottedList">
            {gameList.map((game) => (
              <GameSummaryView {...game} key={game.gameId.toString()} />
            ))}
          </div>
        )}
        <div>
          <button className="primary narrow" onClick={() => navigate("/game/new")}>
            Create New Game
          </button>
        </div>
      </div>

      <div className="spacedSection">
        <h2>Recent forum posts</h2>
        {"message" in threadList ? (
          <div>{threadList.message}</div>
        ) : (
          <div id="threadList" role="list" className="dottedList">
            {threadList.map((thread) => (
              <ThreadSummaryView {...thread} key={thread.threadId.toString()} />
            ))}
          </div>
        )}
        <div>
          <button className="primary narrow" onClick={() => navigate("/forum/post/new")}>
            Create New Post
          </button>
        </div>
      </div>
    </div>
  );
}
