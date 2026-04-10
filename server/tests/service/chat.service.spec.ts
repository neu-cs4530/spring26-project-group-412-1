import { describe, expect, it } from "vitest";
import { enforceAuth } from "../../src/services/auth.service.ts";
import {
  addMessageToChat,
  addMoveLogToChat,
  createChat,
  forceChatById,
  getMoveLog,
} from "../../src/services/chat.service.ts";
import { createMessage } from "../../src/services/message.service.ts";

describe("chat.service - addMoveLogToChat", () => {
  it("appends a move log entry and returns the payload", async () => {
    const user = await enforceAuth({ username: "user1", password: "pwd1111" });
    const chat = await createChat(new Date("2026-01-01T00:00:00.000Z"));
    const createdAt = new Date("2026-01-01T00:01:00.000Z");

    const payload = await addMoveLogToChat(chat.chatId, " took three tokens", user, createdAt);

    expect(payload.chatId).toBe(chat.chatId);
    expect(payload.moveDescription).toBe(" took three tokens");
    expect(payload.user.username).toBe("user1");
    expect(payload.createdAt).toEqual(createdAt);
  });

  it("throws when the chat id does not exist", async () => {
    const user = await enforceAuth({ username: "user1", password: "pwd1111" });
    await expect(
      addMoveLogToChat("nonexistent-chat-id", " moved", user, new Date()),
    ).rejects.toThrow("invalid chat id");
  });
});

describe("chat.service - getMoveLog", () => {
  it("returns the move log entries after they have been added", async () => {
    const user = await enforceAuth({ username: "user1", password: "pwd1111" });
    const chat = await createChat(new Date("2026-01-01T00:00:00.000Z"));
    const createdAt = new Date("2026-01-01T00:01:00.000Z");

    await addMoveLogToChat(chat.chatId, " moved first", user, createdAt);
    await addMoveLogToChat(chat.chatId, " moved second", user, createdAt);

    const log = await getMoveLog(chat.chatId);
    expect(log).toHaveLength(2);
    expect(log[0].moveDescription).toBe(" moved first");
    expect(log[1].moveDescription).toBe(" moved second");
  });

  it("returns an empty array for a non-existent chat id", async () => {
    const log = await getMoveLog("nonexistent-chat-id");
    expect(log).toStrictEqual([]);
  });
});

describe("chat.service - forceChatById with move log", () => {
  it("populateChatInfo maps move log entries when the chat has them", async () => {
    const user = await enforceAuth({ username: "user1", password: "pwd1111" });
    const chat = await createChat(new Date("2026-01-01T00:00:00.000Z"));
    await addMoveLogToChat(chat.chatId, " made a move", user, new Date("2026-01-01T00:01:00.000Z"));
    const fullChat = await forceChatById(chat.chatId, user);
    expect(fullChat.moveLog).toHaveLength(1);
    expect(fullChat.moveLog[0].moveDescription).toBe(" made a move");
    expect(fullChat.moveLog[0].user.username).toBe("user1");
  });
});

describe("chat.service - addMessageToChat", () => {
  it("adds a message and returns updated chat info", async () => {
    const user = await enforceAuth({ username: "user1", password: "pwd1111" });
    const chat = await createChat(new Date("2026-01-01T00:00:00.000Z"));
    const message = await createMessage(user, "hello", new Date("2026-01-01T00:01:00.000Z"));

    const updated = await addMessageToChat(chat.chatId, user, message.messageId);
    expect(updated.messages).toHaveLength(1);
    expect(updated.messages[0].messageId).toBe(message.messageId);
    expect(updated.messages[0].text).toBe("hello");
  });

  it("throws when the chat id does not exist", async () => {
    const user = await enforceAuth({ username: "user1", password: "pwd1111" });
    const message = await createMessage(user, "hello", new Date());
    await expect(
      addMessageToChat("nonexistent-chat-id", user, message.messageId),
    ).rejects.toThrow("invalid chat id");
  });
});
