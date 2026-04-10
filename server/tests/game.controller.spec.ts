import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameServer, GameServerSocket } from "../src/types.ts";
import { logSocketError } from "../src/controllers/socket.controller.ts";
import {
  socketJoinAsPlayer,
  socketMakeMove,
  socketStart,
  socketWatch,
} from "../src/controllers/game.controller.ts";
import { createGame, joinGame, startGame } from "../src/services/game.service.ts";
import { enforceAuth } from "../src/services/auth.service.ts";

vi.mock(import("../src/controllers/socket.controller.ts"), () => {
  return { logSocketError: vi.fn() };
});

const MockGameServer = vi.fn(
  class {
    to = vi.fn(() => this);
    emit = vi.fn();
  },
);

const MockGameServerSocket = vi.fn(
  class {
    id = "mockGameServerSocket";
    rooms = new Set<string>();
    join = vi.fn((rooms: string | string[]) => {
      const toAdd = Array.isArray(rooms) ? rooms : [rooms];
      for (const r of toAdd) this.rooms.add(r);
    });
    leave = vi.fn((room: string) => {
      this.rooms.delete(room);
    });
    emit = vi.fn();
    to = vi.fn(() => this);
  },
);

const mockServer = new MockGameServer() as unknown as GameServer;
const mockSocket = new MockGameServerSocket() as unknown as GameServerSocket;

const auth1 = { username: "user1", password: "pwd1111" };
const auth2 = { username: "user2", password: "pwd2222" };
const badAuth = { username: "user1", password: "nope" };

afterEach(() => {
  vi.resetAllMocks();
});

describe("socketWatch", () => {
  it("emits gameWatched and joins game + user rooms for a player", async () => {
    const host = await enforceAuth(auth1);
    const game = await createGame(host, "nim", new Date());

    await socketWatch(mockSocket, mockServer)({ auth: auth1, payload: game.gameId });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockSocket.join).toHaveBeenCalled();
    expect(mockSocket.emit).toHaveBeenCalledWith(
      "gameWatched",
      expect.objectContaining({ gameId: game.gameId }),
    );
  });

  it("emits gameWatched and joins only the game room for a non-player watcher", async () => {
    const host = await enforceAuth(auth1);
    const game = await createGame(host, "nim", new Date());

    // user2 is not a player, just watching
    await socketWatch(mockSocket, mockServer)({ auth: auth2, payload: game.gameId });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockSocket.join).toHaveBeenCalledWith([game.gameId]);
    expect(mockSocket.emit).toHaveBeenCalledWith(
      "gameWatched",
      expect.objectContaining({ gameId: game.gameId }),
    );
  });

  it("calls logSocketError on bad auth", async () => {
    const host = await enforceAuth(auth1);
    const game = await createGame(host, "nim", new Date());

    await socketWatch(mockSocket, mockServer)({ auth: badAuth, payload: game.gameId });

    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(
      mockSocket,
      new Error("Invalid auth"),
    );
  });
});

describe("socketJoinAsPlayer", () => {
  it("joins a nim game, emits gamePlayersUpdated, and auto-starts the game when full", async () => {
    const host = await enforceAuth(auth1);
    const game = await createGame(host, "nim", new Date());

    await socketJoinAsPlayer(mockSocket, mockServer)({ auth: auth2, payload: game.gameId });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockServer.to).toHaveBeenCalledWith(game.gameId);
    expect(mockServer.emit).toHaveBeenCalledWith("gamePlayersUpdated", expect.any(Array));
    // nim fills at 2 players → auto-start triggers gameStateUpdated
    expect(mockServer.emit).toHaveBeenCalledWith("gameStateUpdated", expect.any(Object));
  });

  it("calls logSocketError on bad auth", async () => {
    const host = await enforceAuth(auth1);
    const game = await createGame(host, "nim", new Date());

    await socketJoinAsPlayer(mockSocket, mockServer)({ auth: badAuth, payload: game.gameId });

    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(
      mockSocket,
      new Error("Invalid auth"),
    );
  });
});

describe("socketStart", () => {
  it("starts a game and sends view updates to all watchers and players", async () => {
    const host = await enforceAuth(auth1);
    const joiner = await enforceAuth(auth2);
    // monopoly has minPlayers=2 and maxPlayers=4, so joining a second player does NOT auto-start
    const game = await createGame(host, "monopoly", new Date());
    await joinGame(game.gameId, joiner);

    await socketStart(mockSocket, mockServer)({ auth: auth1, payload: game.gameId });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockServer.to).toHaveBeenCalledWith(game.gameId);
    expect(mockServer.emit).toHaveBeenCalledWith("gameStateUpdated", expect.any(Object));
  });

  it("calls logSocketError on bad auth", async () => {
    const host = await enforceAuth(auth1);
    const game = await createGame(host, "nim", new Date());

    await socketStart(mockSocket, mockServer)({ auth: badAuth, payload: game.gameId });

    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(
      mockSocket,
      new Error("Invalid auth"),
    );
  });
});

describe("socketMakeMove", () => {
  it("makes a nim move and emits gameStateUpdated and chatMoveLog", async () => {
    const host = await enforceAuth(auth1);
    const joiner = await enforceAuth(auth2);
    const game = await createGame(host, "nim", new Date());
    await joinGame(game.gameId, joiner);
    await startGame(game.gameId, host);

    await socketMakeMove(mockSocket, mockServer)({
      auth: auth1,
      payload: { gameId: game.gameId, move: 1 },
    });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(mockServer.emit).toHaveBeenCalledWith("gameStateUpdated", expect.any(Object));
    expect(mockServer.emit).toHaveBeenCalledWith("chatMoveLog", expect.any(Object));
  });

  it("calls logSocketError on bad auth", async () => {
    const host = await enforceAuth(auth1);
    const joiner = await enforceAuth(auth2);
    const game = await createGame(host, "nim", new Date());
    await joinGame(game.gameId, joiner);
    await startGame(game.gameId, host);

    await socketMakeMove(mockSocket, mockServer)({
      auth: badAuth,
      payload: { gameId: game.gameId, move: 1 },
    });

    expect(logSocketError).toHaveBeenCalledExactlyOnceWith(
      mockSocket,
      new Error("Invalid auth"),
    );
  });
});
