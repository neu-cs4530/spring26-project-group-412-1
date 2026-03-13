import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InviteInfo, UserAuth } from "@gamenite/shared";

const { mockPost, mockGet, mockExceptionToErrorMsg } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockGet: vi.fn(),
  mockExceptionToErrorMsg: vi.fn(),
}));

vi.mock("../../src/services/api.ts", () => ({
  api: {
    post: mockPost,
    get: mockGet,
  },
  exceptionToErrorMsg: mockExceptionToErrorMsg,
}));

import {
  acceptInviteRequest,
  declineInviteRequest,
  getMineInvites,
  sendInviteRequest,
} from "../../src/services/inviteService.ts";

const auth: UserAuth = { username: "user2", password: "pwd2222" };

function rawInvite(inviteId = "invite-1"): InviteInfo {
  const now = new Date();
  return {
    inviteId,
    roomId: "room-1",
    gameType: "monopoly",
    inviterId: "host-id",
    inviteeId: "invitee-id",
    status: "pending",
    createdAt: now.toISOString() as unknown as Date,
    updatedAt: now.toISOString() as unknown as Date,
    expiresAt: new Date(now.getTime() + 5 * 60 * 1000).toISOString() as unknown as Date,
  };
}

describe("inviteService", () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockGet.mockReset();
    mockExceptionToErrorMsg.mockReset();
  });

  it("calls POST /mine with includeHistory=false and revives date fields", async () => {
    mockPost.mockResolvedValue({ data: [rawInvite("invite-list")] });

    const result = await getMineInvites(auth);

    expect(mockPost).toHaveBeenCalledExactlyOnceWith("/api/invite/mine", {
      auth,
      payload: { includeHistory: false },
    });
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result).toHaveLength(1);
      expect(result[0].createdAt).toBeInstanceOf(Date);
      expect(result[0].updatedAt).toBeInstanceOf(Date);
      expect(result[0].expiresAt).toBeInstanceOf(Date);
    }
  });

  it("calls canonical endpoints for send/accept/decline with expected payloads", async () => {
    mockPost
      .mockResolvedValueOnce({ data: rawInvite("invite-send") })
      .mockResolvedValueOnce({ data: { ...rawInvite("invite-accept"), status: "accepted" } })
      .mockResolvedValueOnce({ data: { ...rawInvite("invite-decline"), status: "declined" } });

    await sendInviteRequest(auth, "room-1", "user3");
    await acceptInviteRequest(auth, "invite-accept");
    await declineInviteRequest(auth, "invite-decline");

    expect(mockPost).toHaveBeenNthCalledWith(1, "/api/invite/send", {
      auth,
      payload: { roomId: "room-1", inviteeUsername: "user3" },
    });
    expect(mockPost).toHaveBeenNthCalledWith(2, "/api/invite/invite-accept/accept", {
      auth,
      payload: {},
    });
    expect(mockPost).toHaveBeenNthCalledWith(3, "/api/invite/invite-decline/decline", {
      auth,
      payload: {},
    });
  });

  it("returns mapped ErrorMsg when request throws", async () => {
    mockPost.mockRejectedValue(new Error("network"));
    mockExceptionToErrorMsg.mockReturnValue({ error: "mapped failure" });

    const result = await sendInviteRequest(auth, "room-1", "user3");

    expect(mockExceptionToErrorMsg).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
    expect(result).toStrictEqual({ error: "mapped failure" });
  });
});
