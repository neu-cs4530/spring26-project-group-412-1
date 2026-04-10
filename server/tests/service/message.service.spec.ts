import { describe, expect, it } from "vitest";
import { enforceAuth } from "../../src/services/auth.service.ts";
import { createMessage, toggleMessageReaction } from "../../src/services/message.service.ts";
import { MessageRepo } from "../../src/repository.ts";

describe("message.service reactions", () => {
  it("creates a message with an empty reactions array", async () => {
    const author = await enforceAuth({ username: "user1", password: "pwd1111" });
    const message = await createMessage(
      author,
      "fresh message",
      new Date("2026-01-01T00:00:00.000Z"),
    );
    expect(message.reactions).toStrictEqual([]);
  });

  it("adds, changes, and removes a single user's reaction on a message", async () => {
    const author = await enforceAuth({ username: "user1", password: "pwd1111" });
    const reactor = await enforceAuth({ username: "user2", password: "pwd2222" });
    const message = await createMessage(
      author,
      "hello world",
      new Date("2026-01-01T00:00:00.000Z"),
    );

    const added = await toggleMessageReaction(reactor, message.messageId, "👍");
    expect(added.action).toBe("added");
    expect(added.message.reactions).toStrictEqual([
      {
        emoji: "👍",
        reactedBy: [expect.objectContaining({ username: "user2" })],
      },
    ]);

    const changed = await toggleMessageReaction(reactor, message.messageId, "😂");
    expect(changed.action).toBe("added");
    expect(changed.message.reactions).toStrictEqual([
      {
        emoji: "😂",
        reactedBy: [expect.objectContaining({ username: "user2" })],
      },
    ]);

    const removed = await toggleMessageReaction(reactor, message.messageId, "😂");
    expect(removed.action).toBe("removed");
    expect(removed.message.reactions).toStrictEqual([]);
  });

  it("appends a user to an existing emoji group when another user already has that reaction", async () => {
    const author = await enforceAuth({ username: "user1", password: "pwd1111" });
    const user2 = await enforceAuth({ username: "user2", password: "pwd2222" });
    const user3 = await enforceAuth({ username: "user3", password: "pwd3333" });
    const message = await createMessage(
      author,
      "multi-reactor",
      new Date("2026-01-01T00:00:00.000Z"),
    );

    // user2 reacts with 👍, user3 reacts with 😂
    await toggleMessageReaction(user2, message.messageId, "👍");
    await toggleMessageReaction(user3, message.messageId, "😂");

    // user2 switches from 👍 to 😂 — 😂 already has user3 so user2 joins existing group
    const result = await toggleMessageReaction(user2, message.messageId, "😂");
    expect(result.action).toBe("added");
    const emojiGroup = result.message.reactions.find((r) => r.emoji === "😂");
    expect(emojiGroup?.reactedBy.map((u) => u.username).toSorted()).toStrictEqual([
      "user2",
      "user3",
    ]);
    expect(result.message.reactions.find((r) => r.emoji === "👍")).toBeUndefined();
  });

  it("throws when toggling a reaction on a non-existent message id", async () => {
    const user = await enforceAuth({ username: "user1", password: "pwd1111" });
    await expect(toggleMessageReaction(user, "nonexistent-message-id", "👍")).rejects.toThrow(
      "reacted to invalid message id",
    );
  });
});
