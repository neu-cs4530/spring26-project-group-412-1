import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InviteInfo, UserAuth } from "@gamenite/shared";

const {
  mockUseNavigate,
  mockUseThreadList,
  mockUseGameList,
  mockUseAuth,
  mockGetMineInvites,
  mockAcceptInviteRequest,
  mockDeclineInviteRequest,
  mockSocket,
} = vi.hoisted(() => ({
  mockUseNavigate: vi.fn(),
  mockUseThreadList: vi.fn(),
  mockUseGameList: vi.fn(),
  mockUseAuth: vi.fn(),
  mockGetMineInvites: vi.fn(),
  mockAcceptInviteRequest: vi.fn(),
  mockDeclineInviteRequest: vi.fn(),
  mockSocket: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
}));

vi.mock("react-router-dom", async () => {
  const mod = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...mod, useNavigate: () => mockUseNavigate };
});

vi.mock("../../src/hooks/useThreadList.ts", () => ({
  default: mockUseThreadList,
}));

vi.mock("../../src/hooks/useGameList.ts", () => ({
  default: mockUseGameList,
}));

vi.mock("../../src/hooks/useAuth.ts", () => ({
  default: mockUseAuth,
}));

vi.mock("../../src/hooks/useLoginContext.ts", () => ({
  default: () => ({ socket: mockSocket, user: { username: "user2", display: "User Two" } }),
}));

vi.mock("../../src/services/inviteService.ts", () => ({
  getMineInvites: mockGetMineInvites,
  acceptInviteRequest: mockAcceptInviteRequest,
  declineInviteRequest: mockDeclineInviteRequest,
}));

import Home from "../../src/pages/Home.tsx";
import InviteProvider from "../../src/components/InviteProvider.tsx";

function renderHome() {
  return render(
    <InviteProvider>
      <Home />
    </InviteProvider>,
  );
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

describe("Home invites behavior", () => {
  beforeEach(() => {
    mockUseNavigate.mockReset();
    mockUseThreadList.mockReset();
    mockUseGameList.mockReset();
    mockUseAuth.mockReset();
    mockGetMineInvites.mockReset();
    mockAcceptInviteRequest.mockReset();
    mockDeclineInviteRequest.mockReset();

    mockUseThreadList.mockReturnValue({ message: "No threads found..." });
    mockUseGameList.mockReturnValue({ message: "No games found..." });
    mockUseAuth.mockReturnValue(auth);
  });

  it("loads invites on mount, polls every 15s, and clears polling on unmount", async () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    mockGetMineInvites.mockResolvedValue([pendingInvite("invite-1")]);

    const { unmount } = renderHome();

    await waitFor(() => {
      expect(mockGetMineInvites).toHaveBeenCalledTimes(1);
    });

    expect(setIntervalSpy).toHaveBeenCalled();
    const [pollCallback, intervalMs] = setIntervalSpy.mock.calls[0];
    expect(intervalMs).toBe(60_000);
    if (typeof pollCallback === "function") {
      const pollFn = pollCallback as unknown as () => void | Promise<void>;
      await act(async () => {
        await pollFn();
      });
    }

    await waitFor(() => {
      expect(mockGetMineInvites).toHaveBeenCalledTimes(2);
    });

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalledWith(setIntervalSpy.mock.results[0].value);

    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it("accept action calls service, removes invite optimistically, and navigates to room", async () => {
    mockGetMineInvites.mockResolvedValueOnce([pendingInvite("invite-accept")]);
    mockAcceptInviteRequest.mockResolvedValue({
      ...pendingInvite("invite-accept"),
      status: "accepted",
    });

    renderHome();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Accept" })).not.toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() => {
      expect(mockAcceptInviteRequest).toHaveBeenCalledExactlyOnceWith(auth, "invite-accept");
    });
    expect(mockGetMineInvites).toHaveBeenCalledTimes(1);
    expect(mockUseNavigate).toHaveBeenCalledExactlyOnceWith("/game/room-1");
  });

  it("decline action calls service, removes invite optimistically, and updates UI", async () => {
    mockGetMineInvites.mockResolvedValueOnce([pendingInvite("invite-decline")]);
    mockDeclineInviteRequest.mockResolvedValue({
      ...pendingInvite("invite-decline"),
      status: "declined",
    });

    renderHome();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Decline" })).not.toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Decline" }));

    await waitFor(() => {
      expect(mockDeclineInviteRequest).toHaveBeenCalledExactlyOnceWith(auth, "invite-decline");
    });
    await waitFor(() => {
      expect(screen.getByText("No pending invites")).not.toBeNull();
    });
    expect(mockGetMineInvites).toHaveBeenCalledTimes(1);
  });

  it("refreshes invites and surfaces the error when accept fails", async () => {
    mockGetMineInvites
      .mockResolvedValueOnce([pendingInvite("invite-stale")])
      .mockResolvedValueOnce([]);
    mockAcceptInviteRequest.mockResolvedValue({ error: "Invite is expired" });

    renderHome();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Accept" })).not.toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() => {
      expect(mockAcceptInviteRequest).toHaveBeenCalledExactlyOnceWith(auth, "invite-stale");
    });
    await waitFor(() => {
      expect(mockGetMineInvites).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText("Invite is expired")).not.toBeNull();
    expect(mockUseNavigate).not.toHaveBeenCalled();
  });
});
