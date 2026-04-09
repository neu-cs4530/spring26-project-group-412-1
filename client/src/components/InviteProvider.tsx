import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import type { InviteInfo } from "@gamenite/shared";
import { InviteContext } from "../contexts/InviteContext.ts";
import { getMineInvites } from "../services/inviteService.ts";
import useAuth from "../hooks/useAuth.ts";
import useLoginContext from "../hooks/useLoginContext.ts";

const INVITE_POLL_INTERVAL_MS = 60_000;

export default function InviteProvider({ children }: { children: JSX.Element }) {
  const auth = useAuth();
  const { socket } = useLoginContext();
  const [invites, setInvites] = useState<InviteInfo[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshInvites = useCallback(async () => {
    const response = await getMineInvites(auth, false);
    if (!mountedRef.current) return;
    if (!("error" in response)) setInvites(response);
  }, [auth]);

  const removeInvite = useCallback((inviteId: string) => {
    setInvites((prev) => prev.filter((i) => i.inviteId !== inviteId));
  }, []);

  // Initial load + fallback polling (in case socket misses anything)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshInvites();
    const poll = window.setInterval(() => void refreshInvites(), INVITE_POLL_INTERVAL_MS);
    return () => window.clearInterval(poll);
  }, [refreshInvites]);

  // Register with the server so it knows which socket room to push to
  useEffect(() => {
    socket.emit("userRegister", { auth, payload: {} });
  }, [socket, auth]);

  // Real-time: add the invite immediately when the server pushes it
  useEffect(() => {
    const handleInviteReceived = (invite: InviteInfo) => {
      // Ignore invites not meant for this user (guards against stale socket rooms)
      if (invite.inviteeUsername !== auth.username) return;
      setInvites((prev) => {
        if (prev.some((i) => i.inviteId === invite.inviteId)) return prev;
        return [invite, ...prev];
      });
    };

    socket.on("inviteReceived", handleInviteReceived);
    return () => {
      socket.off("inviteReceived", handleInviteReceived);
    };
  }, [socket, auth.username]);

  // Real-time: remove invite when host cancels it
  useEffect(() => {
    const handleStatusUpdated = (invite: InviteInfo) => {
      if (invite.status !== "pending") {
        setInvites((prev) => prev.filter((i) => i.inviteId !== invite.inviteId));
      }
    };

    socket.on("inviteStatusUpdated", handleStatusUpdated);
    return () => {
      socket.off("inviteStatusUpdated", handleStatusUpdated);
    };
  }, [socket]);

  return (
    <InviteContext.Provider
      value={{ invites, pendingCount: invites.length, refreshInvites, removeInvite }}
    >
      {children}
    </InviteContext.Provider>
  );
}
