import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameInfo, InviteInfo, UserAuth } from "@gamenite/shared";

const {
  mockUseParams,
  mockGetGameById,
  mockUseAuth,
  mockGetSentInvites,
  mockSendInviteRequest,
  mockCancelInviteRequest,
} = vi.hoisted(() => ({
  mockUseParams: vi.fn(),
  mockGetGameById: vi.fn(),
  mockUseAuth: vi.fn(),
  mockGetSentInvites: vi.fn(),
  mockSendInviteRequest: vi.fn(),
  mockCancelInviteRequest: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const mod = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...mod,
    useParams: mockUseParams,
  };
});

vi.mock("../../src/services/gameService.ts", () => ({
  getGameById: mockGetGameById,
}));

vi.mock("../../src/hooks/useAuth.ts", () => ({
  default: mockUseAuth,
}));

vi.mock("../../src/services/inviteService.ts", () => ({
  getSentInvites: mockGetSentInvites,
  sendInviteRequest: mockSendInviteRequest,
  cancelInviteRequest: mockCancelInviteRequest,
}));

vi.mock("../../src/components/GamePanel.tsx", () => ({
  default: () => <div>Game Panel</div>,
}));

vi.mock("../../src/components/ChatPanel.tsx", () => ({
  default: () => <div>Chat Panel</div>,
}));

import Game from "../../src/pages/Game.tsx";

const auth: UserAuth = { username: "host", password: "pwd1111" };

const gameInfo: GameInfo = {
  gameId: "room-1",
  type: "monopoly",
  status: "waiting",
  chat: "chat-1",
  players: [],
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  createdBy: {
    username: "host",
    display: "Host",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  minPlayers: 2,
};

function sentInvite(inviteId: string, status: InviteInfo["status"]): InviteInfo {
  const now = new Date("2026-01-02T12:00:00.000Z");
  return {
    inviteId,
    roomId: "room-1",
    gameType: "monopoly",
    inviterId: "host-id",
    inviteeId: `invitee-${inviteId}`,
    status,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
  };
}

describe("Game invite host panel", () => {
  beforeEach(() => {
    mockUseParams.mockReset();
    mockGetGameById.mockReset();
    mockUseAuth.mockReset();
    mockGetSentInvites.mockReset();
    mockSendInviteRequest.mockReset();
    mockCancelInviteRequest.mockReset();

    mockUseParams.mockReturnValue({ gameId: "room-1" });
    mockGetGameById.mockResolvedValue(gameInfo);
    mockUseAuth.mockReturnValue(auth);
  });

  it("loads sent invites for the waiting-room host and lets them cancel a pending invite", async () => {
    mockGetSentInvites
      .mockResolvedValueOnce([
        sentInvite("invite-1", "pending"),
        sentInvite("invite-2", "accepted"),
      ])
      .mockResolvedValueOnce([
        sentInvite("invite-1", "canceled"),
        sentInvite("invite-2", "accepted"),
      ]);
    mockCancelInviteRequest.mockResolvedValue(sentInvite("invite-1", "canceled"));

    render(<Game />);

    expect(await screen.findByText("Sent invites")).not.toBeNull();
    expect(await screen.findByText("invitee-invite-1")).not.toBeNull();
    expect(screen.getByText("invitee-invite-2")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(mockCancelInviteRequest).toHaveBeenCalledExactlyOnceWith(auth, "invite-1");
    });
    await waitFor(() => {
      expect(mockGetSentInvites).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText(/invitee-invite-1/i)).not.toBeNull();
    expect(screen.getByText(/canceled/i)).not.toBeNull();
  });
});
