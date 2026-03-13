import { useEffect, useState } from "react";
import useThreadList from "../hooks/useThreadList.ts";
import ThreadSummaryView from "../components/ThreadSummaryView.tsx";
import { useNavigate } from "react-router-dom";
import useGameList from "../hooks/useGameList.ts";
import GameSummaryView from "../components/GameSummaryView.tsx";
import useAuth from "../hooks/useAuth.ts";
import type { InviteInfo } from "@gamenite/shared";
import {
  acceptInviteRequest,
  declineInviteRequest,
  getMyInvites,
} from "../services/inviteService.ts";

export default function Home() {
  const threadList = useThreadList(4);
  const gameList = useGameList(4);
  const navigate = useNavigate();
  const auth = useAuth();

  const [invites, setInvites] = useState<InviteInfo[]>([]);
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [loadingInvites, setLoadingInvites] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadInvites = async () => {
      setLoadingInvites(true);
      const response = await getMyInvites(auth);

      if (!mounted) return;

      if ("error" in response) {
        setInviteErr(response.error);
        setInvites([]);
      } else {
        setInviteErr(null);
        setInvites(response);
      }

      setLoadingInvites(false);
    };

    void loadInvites();

    return () => {
      mounted = false;
    };
  }, [auth]);

  const handleAccept = async (inviteId: string) => {
    const response = await acceptInviteRequest(auth, inviteId);
    if ("error" in response) {
      setInviteErr(response.error);
      return;
    }

    setInvites((prev) => prev.filter((invite) => invite.inviteId !== inviteId));
    navigate(`/game/${response.roomId}`);
  };

  const handleDecline = async (inviteId: string) => {
    const response = await declineInviteRequest(auth, inviteId);
    if ("error" in response) {
      setInviteErr(response.error);
      return;
    }

    setInvites((prev) => prev.filter((invite) => invite.inviteId !== inviteId));
  };

  return (
    <div className="content">
      <div className="spacedSection">
        <h2>Pending invites</h2>
        {loadingInvites ? (
          <div>Loading invites...</div>
        ) : inviteErr ? (
          <div>{inviteErr}</div>
        ) : invites.length === 0 ? (
          <div>No pending invites</div>
        ) : (
          <div className="dottedList">
            {invites.map((invite) => (
              <div key={invite.inviteId} className="spacedSection">
                <div>
                  <strong>Inviter:</strong> {invite.inviterId}
                </div>
                <div>
                  <strong>Room:</strong> {invite.roomId}
                </div>
                <div>
                  <strong>Sent:</strong> {invite.createdAt.toLocaleString()}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button className="primary narrow" onClick={() => handleAccept(invite.inviteId)}>
                    Accept
                  </button>
                  <button
                    className="secondary narrow"
                    onClick={() => handleDecline(invite.inviteId)}
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
