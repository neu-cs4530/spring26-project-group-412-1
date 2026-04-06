import { describe, expect, it } from "vitest";
import { enforceAuth } from "../../src/services/auth.service.ts";
import { createMessage, toggleMessageReaction } from "../../src/services/message.service.ts";

describe("message.service reactions", () => {
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
});
