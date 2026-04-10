import { act, render, screen, waitFor } from "@testing-library/react";
import { useContext } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InviteInfo, UserAuth } from "@gamenite/shared";
import { InviteContext } from "../../src/contexts/InviteContext.ts";

const { mockGetMineInvites, mockUseAuth, mockSocket } = vi.hoisted(() => ({
  mockGetMineInvites: vi.fn(),
  mockUseAuth: vi.fn(),
  mockSocket: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
}));

vi.mock("../../src/services/inviteService.ts", () => ({
  getMineInvites: mockGetMineInvites,
}));

vi.mock("../../src/hooks/useAuth.ts", () => ({
  default: mockUseAuth,
}));

vi.mock("../../src/hooks/useLoginContext.ts", () => ({
  default: () => ({ socket: mockSocket, user: { username: "user2", display: "User Two" } }),
}));

import InviteProvider from "../../src/components/InviteProvider.tsx";

function InviteDisplay() {
  const { invites } = useContext(InviteContext);
  return <div data-testid="count">{invites.length}</div>;
}

const auth: UserAuth = { username: "user2", password: "pwd2222" };

function pendingInvite(inviteId: string): InviteInfo {
  const now = new Date();
  return {
    inviteId,
    roomId: "room-1",
    gameType: "monopoly",
    inviterId: "host-id",
    inviterUsername: "host",
    inviteeId: "invitee-id",
    inviteeUsername: "user2",
    status: "pending",
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
  };
}

function renderProvider() {
  return render(
    <InviteProvider>
      <InviteDisplay />
    </InviteProvider>,
  );
}

function getSocketHandler(event: string): ((...args: unknown[]) => void) | undefined {
  const call = mockSocket.on.mock.calls.find(([e]: [string]) => e === event);
  return call?.[1] as ((...args: unknown[]) => void) | undefined;
}

describe("InviteProvider socket behavior", () => {
  beforeEach(() => {
    mockGetMineInvites.mockReset();
    mockUseAuth.mockReset();
    mockSocket.on.mockReset();
    mockSocket.off.mockReset();
    mockSocket.emit.mockReset();
    mockUseAuth.mockReturnValue(auth);
  });

  it("adds an invite to the list when the socket emits inviteReceived for this user", async () => {
    mockGetMineInvites.mockResolvedValue([]);
    renderProvider();

    await waitFor(() => expect(mockGetMineInvites).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("count").textContent).toBe("0");

    const handler = getSocketHandler("inviteReceived");
    expect(handler).toBeDefined();
    act(() => {
      handler!(pendingInvite("invite-new"));
    });

    expect(screen.getByTestId("count").textContent).toBe("1");
  });

  it("ignores inviteReceived when the invite is for a different user", async () => {
    mockGetMineInvites.mockResolvedValue([]);
    renderProvider();

    await waitFor(() => expect(mockGetMineInvites).toHaveBeenCalledTimes(1));

    const handler = getSocketHandler("inviteReceived");
    expect(handler).toBeDefined();
    act(() => {
      handler!({ ...pendingInvite("invite-wrong"), inviteeUsername: "other-user" });
    });

    expect(screen.getByTestId("count").textContent).toBe("0");
  });

  it("does not add a duplicate invite when inviteReceived fires for an already-listed invite", async () => {
    const existing = pendingInvite("invite-dup");
    mockGetMineInvites.mockResolvedValue([existing]);
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));

    const handler = getSocketHandler("inviteReceived");
    expect(handler).toBeDefined();
    act(() => {
      handler!(existing);
    });

    expect(screen.getByTestId("count").textContent).toBe("1");
  });

  it("removes an invite from the list when inviteStatusUpdated fires with a non-pending status", async () => {
    const existing = pendingInvite("invite-to-cancel");
    mockGetMineInvites.mockResolvedValue([existing]);
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));

    const handler = getSocketHandler("inviteStatusUpdated");
    expect(handler).toBeDefined();
    act(() => {
      handler!({ ...existing, status: "canceled" });
    });

    expect(screen.getByTestId("count").textContent).toBe("0");
  });

  it("keeps an invite in the list when inviteStatusUpdated fires with a still-pending status", async () => {
    const existing = pendingInvite("invite-still-pending");
    mockGetMineInvites.mockResolvedValue([existing]);
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));

    const handler = getSocketHandler("inviteStatusUpdated");
    expect(handler).toBeDefined();
    act(() => {
      handler!({ ...existing, status: "pending" });
    });

    expect(screen.getByTestId("count").textContent).toBe("1");
  });
});
