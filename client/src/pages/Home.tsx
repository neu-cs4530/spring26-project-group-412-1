import { useCallback, useEffect, useRef, useState } from "react";
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
  getMineInvites,
} from "../services/inviteService.ts";

const INVITE_POLL_INTERVAL_MS = 15_000;

export default function Home() {
  const threadList = useThreadList(4);
  const gameList = useGameList(4);
  const navigate = useNavigate();
  const auth = useAuth();

  const [invites, setInvites] = useState<InviteInfo[]>([]);
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [inviteActionId, setInviteActionId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refreshInvites = useCallback(async () => {
    const response = await getMineInvites(auth, false);

    if (!mountedRef.current) return;

    if ("error" in response) {
      setInviteErr(response.error);
      setInvites([]);
    } else {
      setInviteErr(null);
      setInvites(response);
    }

    setLoadingInvites(false);
  }, [auth]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const initialLoadTimer = window.setTimeout(() => {
      void refreshInvites();
    }, 0);
    const pollTimer = window.setInterval(() => {
      void refreshInvites();
    }, INVITE_POLL_INTERVAL_MS);

    return () => {
      window.clearTimeout(initialLoadTimer);
      window.clearInterval(pollTimer);
    };
  }, [refreshInvites]);

  const handleAccept = async (inviteId: string) => {
    setInviteActionId(inviteId);
    setInviteErr(null);
    const response = await acceptInviteRequest(auth, inviteId);
    if ("error" in response) {
      await refreshInvites();
      if (mountedRef.current) {
        setInviteErr(response.error);
        setInviteActionId(null);
      }
      return;
    }

    await refreshInvites();
    if (mountedRef.current) {
      setInviteActionId(null);
    }
    navigate(`/game/${response.roomId}`);
  };

  const handleDecline = async (inviteId: string) => {
    setInviteActionId(inviteId);
    setInviteErr(null);
    const response = await declineInviteRequest(auth, inviteId);
    if ("error" in response) {
      await refreshInvites();
      if (mountedRef.current) {
        setInviteErr(response.error);
        setInviteActionId(null);
      }
      return;
    }

    await refreshInvites();
    if (mountedRef.current) {
      setInviteActionId(null);
    }
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
