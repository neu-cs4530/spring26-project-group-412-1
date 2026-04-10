import { describe, expect, it } from "vitest";
import {
  zInviteInfo,
  zToggleMessageReactionRequest,
  zBoardReactionRequest,
} from "../src/index.ts";

describe("InviteInfo type", () => {
  it("includes inviterUsername and inviteeUsername fields in the schema", () => {
    const result = zInviteInfo.safeParse({
      inviteId: "invite-1",
      roomId: "room-1",
      gameType: "monopoly",
      inviterId: "user-id-1",
      inviteeId: "user-id-2",
      inviterUsername: "host",
      inviteeUsername: "guest",
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inviterUsername).toBe("host");
      expect(result.data.inviteeUsername).toBe("guest");
    }
  });

  it("rejects an InviteInfo that is missing the inviterUsername field", () => {
    const result = zInviteInfo.safeParse({
      inviteId: "invite-1",
      roomId: "room-1",
      gameType: "monopoly",
      inviterId: "user-id-1",
      inviteeId: "user-id-2",
      inviteeUsername: "guest",
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid invite statuses", () => {
    const statuses = ["pending", "accepted", "declined", "expired", "canceled"] as const;
    for (const status of statuses) {
      const result = zInviteInfo.safeParse({
        inviteId: "invite-1",
        roomId: "room-1",
        gameType: "monopoly",
        inviterId: "user-id-1",
        inviteeId: "user-id-2",
        inviterUsername: "host",
        inviteeUsername: "guest",
        status,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("zToggleMessageReactionRequest", () => {
  it("accepts a valid reaction payload with an allowed emoji", () => {
    const result = zToggleMessageReactionRequest.safeParse({
      chatId: "chat-1",
      messageId: "msg-1",
      emoji: "👍",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.emoji).toBe("👍");
    }
  });

  it("accepts all three allowed reaction emojis", () => {
    const emojis = ["👍", "😂", "😡"] as const;
    for (const emoji of emojis) {
      const result = zToggleMessageReactionRequest.safeParse({
        chatId: "chat-1",
        messageId: "msg-1",
        emoji,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects an emoji that is not in the allowed set", () => {
    const result = zToggleMessageReactionRequest.safeParse({
      chatId: "chat-1",
      messageId: "msg-1",
      emoji: "🔥",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload with a missing emoji field", () => {
    const result = zToggleMessageReactionRequest.safeParse({
      chatId: "chat-1",
      messageId: "msg-1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload missing chatId", () => {
    const result = zToggleMessageReactionRequest.safeParse({
      messageId: "msg-1",
      emoji: "👍",
    });
    expect(result.success).toBe(false);
  });
});

describe("zBoardReactionRequest", () => {
  it("accepts any string as the emoji for board reactions", () => {
    const result = zBoardReactionRequest.safeParse({
      chatId: "chat-1",
      emoji: "🔥",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.emoji).toBe("🔥");
    }
  });

  it("accepts emojis not in the restricted chat reaction set", () => {
    const result = zBoardReactionRequest.safeParse({
      chatId: "chat-1",
      emoji: "🎉",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a payload missing chatId", () => {
    const result = zBoardReactionRequest.safeParse({
      emoji: "🔥",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload missing emoji", () => {
    const result = zBoardReactionRequest.safeParse({
      chatId: "chat-1",
    });
    expect(result.success).toBe(false);
  });
});
