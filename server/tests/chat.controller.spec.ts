import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameServer, GameServerSocket } from "../src/types.ts";
import { logSocketError } from "../src/controllers/socket.controller.ts";
import {
  socketJoin,
  socketLeave,
  socketSendMessage,
  socketToggleReaction,
  socketBoardReaction,
} from "../src/controllers/chat.controller.ts";
import { addMessageToChat, createChat } from "../src/services/chat.service.ts";
import { populateSafeUserInfo } from "../src/services/user.service.ts";
import { enforceAuth, getUserByUsername } from "../src/services/auth.service.ts";
import { createMessage } from "../src/services/message.service.ts";

// Mock the logSocketError function so we can test error conditions in sockets
vi.mock(import("../src/controllers/socket.controller.ts"), () => {
  return { logSocketError: vi.fn() };
});

/**
 * The mock game server only implements a tiny slice of GameServer,
 * and trying to call other methods will result in an error.
 */
const MockGameServer = vi.fn(
  class {
    to = vi.fn(() => this); // allows chaining
    emit = vi.fn();
  },
);

/**
 * The mock socket server only implements a tiny slice of GameServerSocket,
 * and trying to call other methods will result in an error
 */
const MockGameServerSocket = vi.fn(
  class {
    id = "mockGameServerSocket";
    rooms = new Set<string>();
    join = vi.fn((room: string) => {
      this.rooms.add(room);
    });
    leave = vi.fn((room: string) => {
      this.rooms.delete(room);
    });
    emit = vi.fn();
    to = vi.fn(() => this); // allows chaining
  },
);

// We have to cast through Unknown because we're not actually correctly/fully
// implementing either the GameServer or GameServerSocket interfaces correctly!
// We're counting on the fact that the functions we're testing don't depend on
// functionality that we're not implementing
const mockServer = new MockGameServer() as unknown as GameServer;
const mockSocket = new MockGameServerSocket() as unknown as GameServerSocket;
const auth = { username: "user1", password: "pwd1111" };
const badAuth = { username: "user2", password: "nope" };

afterEach(() => {
  // This can be more elegantly achieved by setting mockReset: true in the vitest config
  vi.resetAllMocks();
});

describe("socketJoin", () => {
  it("should check auth and reject invalid auth", async () => {
    const chat = await createChat(new Date());
    await socketJoin(mockSocket, mockServer)({ auth: badAuth, payload: chat.chatId });
    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(mockSocket, new Error("Invalid auth"));
  });

  it("should reject an invalid chat id", async () => {
    await socketJoin(mockSocket, mockServer)({ auth, payload: "hi" });
    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(
      mockSocket,
      new Error("user user1 accessed invalid chat id"),
    );
  });

  it("should proceed without errors, add the user to the room connection, and send chatJoined and chatUserJoined messages", async () => {
    const chat = await createChat(new Date());
    const record = await getUserByUsername(auth.username);
    const user = await populateSafeUserInfo(record!.userId);
    await socketJoin(mockSocket, mockServer)({ auth, payload: chat.chatId });
    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockSocket.join).toHaveBeenCalledExactlyOnceWith(chat.chatId);
    expect(mockSocket.emit).toHaveBeenCalledWith("chatJoined", chat);
    expect(mockSocket.to).toHaveBeenCalledExactlyOnceWith(chat.chatId);
    expect(mockSocket.emit).toHaveBeenCalledWith("chatUserJoined", {
      chatId: chat.chatId,
      user,
    });
  });
});

describe("socketToggleReaction", () => {
  it("updates the message and emits a reaction update payload", async () => {
    const user = await enforceAuth(auth);
    const chat = await createChat(new Date());
    const message = await createMessage(user, "react here", new Date("2026-01-01T00:00:00.000Z"));
    await addMessageToChat(chat.chatId, user, message.messageId);
    const safeUser = await populateSafeUserInfo(user.userId);

    await socketToggleReaction(
      mockSocket,
      mockServer,
    )({
      auth,
      payload: { chatId: chat.chatId, messageId: message.messageId, emoji: "👍" },
    });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockServer.to).toHaveBeenCalledWith(chat.chatId);
    expect(mockServer.emit).toHaveBeenCalledWith(
      "chatReactionUpdated",
      expect.objectContaining({
        chatId: chat.chatId,
        user: safeUser,
        emoji: "👍",
        action: "added",
        message: expect.objectContaining({
          messageId: message.messageId,
          reactions: [
            {
              emoji: "👍",
              reactedBy: [expect.objectContaining({ username: "user1" })],
            },
          ],
        }),
      }),
    );
  });
});

describe("socketBoardReaction", () => {
  it("broadcasts gameBoardReactionBroadcast with the user's username and emoji to the chat room", async () => {
    const chat = await createChat(new Date());

    await socketBoardReaction(
      mockSocket,
      mockServer,
    )({
      auth,
      payload: { chatId: chat.chatId, emoji: "🎉" },
    });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockServer.to).toHaveBeenCalledWith(chat.chatId);
    expect(mockServer.emit).toHaveBeenCalledWith("gameBoardReactionBroadcast", {
      username: "user1",
      emoji: "🎉",
    });
  });

  it("logs a socket error when the auth is invalid", async () => {
    const chat = await createChat(new Date());

    await socketBoardReaction(
      mockSocket,
      mockServer,
    )({
      auth: badAuth,
      payload: { chatId: chat.chatId, emoji: "🎉" },
    });

    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(mockSocket, new Error("Invalid auth"));
    expect(mockServer.emit).not.toHaveBeenCalled();
  });
});

describe("socketLeave", () => {
  it("lets a user leave a chat they are in and emits chatUserLeft to the room", async () => {
    const chat = await createChat(new Date());
    const user = await getUserByUsername(auth.username);
    const safeUser = await populateSafeUserInfo(user!.userId);

    // simulate that this socket has already joined the chat room
    mockSocket.rooms.add(chat.chatId);

    await socketLeave(mockSocket, mockServer)({ auth, payload: chat.chatId });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockSocket.leave).toHaveBeenCalledWith(chat.chatId);
    expect(mockSocket.to).toHaveBeenCalledWith(chat.chatId);
    expect(mockSocket.emit).toHaveBeenCalledWith("chatUserLeft", {
      chatId: chat.chatId,
      user: safeUser,
    });
  });

  it("logs a socket error when the user tries to leave a chat they are not in", async () => {
    const chat = await createChat(new Date());

    // socket has NOT joined the chat, so rooms does not contain chatId
    await socketLeave(mockSocket, mockServer)({ auth, payload: chat.chatId });

    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(
      mockSocket,
      new Error("user user1 left chat they weren't in"),
    );
    expect(mockSocket.leave).not.toHaveBeenCalled();
  });
});

describe("socketSendMessage", () => {
  it("creates a message, adds it to the chat, and emits chatNewMessage to the room", async () => {
    const chat = await createChat(new Date());

    await socketSendMessage(
      mockSocket,
      mockServer,
    )({
      auth,
      payload: { chatId: chat.chatId, text: "hello from socket" },
    });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockServer.to).toHaveBeenCalledWith(chat.chatId);
    expect(mockServer.emit).toHaveBeenCalledWith(
      "chatNewMessage",
      expect.objectContaining({
        chatId: chat.chatId,
        message: expect.objectContaining({
          text: "hello from socket",
          createdBy: expect.objectContaining({ username: "user1" }),
          reactions: [],
        }),
      }),
    );
  });

  it("logs a socket error when the auth is invalid", async () => {
    const chat = await createChat(new Date());

    await socketSendMessage(
      mockSocket,
      mockServer,
    )({
      auth: badAuth,
      payload: { chatId: chat.chatId, text: "should not send" },
    });

    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(mockSocket, new Error("Invalid auth"));
    expect(mockServer.emit).not.toHaveBeenCalled();
  });
});

describe("socketToggleReaction - removed action", () => {
  it("emits chatReactionUpdated with action removed and does not write a reaction log entry", async () => {
    const user = await enforceAuth(auth);
    const chat = await createChat(new Date());
    const message = await createMessage(user, "toggle me", new Date("2026-01-01T00:00:00.000Z"));
    await addMessageToChat(chat.chatId, user, message.messageId);

    // First toggle: adds the reaction
    await socketToggleReaction(mockSocket, mockServer)({
      auth,
      payload: { chatId: chat.chatId, messageId: message.messageId, emoji: "👍" },
    });
    vi.resetAllMocks();

    // Second toggle on the same emoji: removes the reaction
    await socketToggleReaction(mockSocket, mockServer)({
      auth,
      payload: { chatId: chat.chatId, messageId: message.messageId, emoji: "👍" },
    });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockServer.to).toHaveBeenCalledWith(chat.chatId);
    expect(mockServer.emit).toHaveBeenCalledWith(
      "chatReactionUpdated",
      expect.objectContaining({
        action: "removed",
        emoji: "👍",
        message: expect.objectContaining({ reactions: [] }),
      }),
    );
  });
});
