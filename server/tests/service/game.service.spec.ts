import { describe, expect, it } from "vitest";
import { enforceAuth } from "../../src/services/auth.service.ts";
import {
  createGame,
  getGameById,
  joinGame,
  startGame,
  updateGame,
  viewGame,
} from "../../src/services/game.service.ts";

describe("game.service", () => {
  it("fills and starts a Monopoly room with four players", async () => {
    const host = await enforceAuth({ username: "user0", password: "pwd0000" });
    const player2 = await enforceAuth({ username: "user1", password: "pwd1111" });
    const player3 = await enforceAuth({ username: "user2", password: "pwd2222" });
    const player4 = await enforceAuth({ username: "user3", password: "pwd3333" });
    const now = new Date("2026-01-01T00:00:00.000Z");

    const game = await createGame(host, "monopoly", now);
    await joinGame(game.gameId, player2);
    await joinGame(game.gameId, player3);
    const fullRoom = await joinGame(game.gameId, player4);

    expect(fullRoom.status).toBe("waiting");
    expect(fullRoom.players.map((player) => player.username)).toStrictEqual([
      "user0",
      "user1",
      "user2",
      "user3",
    ]);

    const started = await startGame(game.gameId, host);
    expect(started.watchers.type).toBe("monopoly");
    if (started.watchers.type !== "monopoly") {
      throw new Error("Expected Monopoly watcher view");
    }
    expect(started.watchers.view.players).toHaveLength(4);
    expect(started.players).toHaveLength(4);
    expect(started.players.map(({ view }) => view.type)).toStrictEqual([
      "monopoly",
      "monopoly",
      "monopoly",
      "monopoly",
    ]);
    for (const { view } of started.players) {
      if (view.type !== "monopoly") {
        throw new Error("Expected Monopoly player view");
      }
      expect(view.view.players).toHaveLength(4);
    }

    const activeGame = await getGameById(game.gameId);
    expect(activeGame?.status).toBe("active");
    expect(activeGame?.players.map((player) => player.username)).toStrictEqual([
      "user0",
      "user1",
      "user2",
      "user3",
    ]);
  });
});

describe("game.service - joinGame error cases", () => {
  it("throws when the game does not exist", async () => {
    const user = await enforceAuth({ username: "user1", password: "pwd1111" });
    await expect(joinGame("nonexistent-game-id", user)).rejects.toThrow("joining invalid game");
  });

  it("throws when the game has already started", async () => {
    const host = await enforceAuth({ username: "user1", password: "pwd1111" });
    const joiner = await enforceAuth({ username: "user2", password: "pwd2222" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(host, "nim", now);
    await joinGame(game.gameId, joiner);
    await startGame(game.gameId, host);
    const latecomer = await enforceAuth({ username: "user3", password: "pwd3333" });
    await expect(joinGame(game.gameId, latecomer)).rejects.toThrow("joining game that started");
  });

  it("throws when the user is already in the game", async () => {
    const host = await enforceAuth({ username: "user1", password: "pwd1111" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(host, "nim", now);
    await expect(joinGame(game.gameId, host)).rejects.toThrow("joining game they are in already");
  });
});

describe("game.service - startGame error cases", () => {
  it("throws when the game has not enough players", async () => {
    const host = await enforceAuth({ username: "user1", password: "pwd1111" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(host, "nim", now);
    await expect(startGame(game.gameId, host)).rejects.toThrow("starting underpopulated game");
  });

  it("throws when the caller is not a player in the game", async () => {
    const host = await enforceAuth({ username: "user1", password: "pwd1111" });
    const joiner = await enforceAuth({ username: "user2", password: "pwd2222" });
    const outsider = await enforceAuth({ username: "user3", password: "pwd3333" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(host, "nim", now);
    await joinGame(game.gameId, joiner);
    await expect(startGame(game.gameId, outsider)).rejects.toThrow("starting game they're not in");
  });
});

describe("game.service - updateGame", () => {
  it("applies a valid nim move and returns updated views", async () => {
    const host = await enforceAuth({ username: "user1", password: "pwd1111" });
    const joiner = await enforceAuth({ username: "user2", password: "pwd2222" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(host, "nim", now);
    await joinGame(game.gameId, joiner);
    await startGame(game.gameId, host);

    const result = await updateGame(game.gameId, host, 3);
    expect(result.views.watchers.type).toBe("nim");
    if (result.views.watchers.type !== "nim") throw new Error("Expected nim view");
    expect(result.views.watchers.view.remaining).toBe(18);
    expect(result.moveDescription).toContain("three tokens");
  });

  it("records the game as done when the last token is taken", async () => {
    const host = await enforceAuth({ username: "user1", password: "pwd1111" });
    const joiner = await enforceAuth({ username: "user2", password: "pwd2222" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(host, "nim", now);
    await joinGame(game.gameId, joiner);
    await startGame(game.gameId, host);

    // Play out a full game: alternate taking 3, 3, 3, 3, 3, 3, 3 tokens (21 total, 7 turns)
    for (let i = 0; i < 6; i++) {
      const mover = i % 2 === 0 ? host : joiner;
      await updateGame(game.gameId, mover, 3);
    }
    // Final move: 3 tokens left, joiner takes them (index=1, turn alternates: 0,1,0,1,0,1 → turn=0 for move 7? let me recalc)
    // After 6 moves (3 each): 21 - 18 = 3 remaining, next player = player at index 0 (started with 0, alternates)
    // Move 1 (host=0): 21→18, next=1; Move 2 (joiner=1): 18→15, next=0
    // Move 3 (host=0): 15→12, next=1; Move 4 (joiner=1): 12→9, next=0
    // Move 5 (host=0): 9→6, next=1; Move 6 (joiner=1): 6→3, next=0
    // Move 7 (host=0): 3→0, done
    const finalResult = await updateGame(game.gameId, host, 3);
    expect(finalResult.moveDescription).toContain("lost the game");

    const doneGame = await getGameById(game.gameId);
    expect(doneGame?.status).toBe("done");
  });

  it("throws when the game does not exist", async () => {
    const user = await enforceAuth({ username: "user1", password: "pwd1111" });
    await expect(updateGame("nonexistent-id", user, 1)).rejects.toThrow("acted on an invalid game");
  });

  it("throws when the game has not started yet", async () => {
    const host = await enforceAuth({ username: "user1", password: "pwd1111" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(host, "nim", now);
    await expect(updateGame(game.gameId, host, 1)).rejects.toThrow(
      "made a move in game of that hadn't started",
    );
  });

  it("throws when the user is not a player in the game", async () => {
    const host = await enforceAuth({ username: "user1", password: "pwd1111" });
    const joiner = await enforceAuth({ username: "user2", password: "pwd2222" });
    const outsider = await enforceAuth({ username: "user3", password: "pwd3333" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(host, "nim", now);
    await joinGame(game.gameId, joiner);
    await startGame(game.gameId, host);
    await expect(updateGame(game.gameId, outsider, 1)).rejects.toThrow(
      "made a move in a game they weren't playing",
    );
  });

  it("throws on an invalid move (wrong player turn or invalid count)", async () => {
    const host = await enforceAuth({ username: "user1", password: "pwd1111" });
    const joiner = await enforceAuth({ username: "user2", password: "pwd2222" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(host, "nim", now);
    await joinGame(game.gameId, joiner);
    await startGame(game.gameId, host);
    // joiner tries to move but it's host's (player 0) turn
    await expect(updateGame(game.gameId, joiner, 1)).rejects.toThrow("made an invalid move");
  });
});

describe("game.service - viewGame", () => {
  it("returns isPlayer=true and null view for a waiting game", async () => {
    const host = await enforceAuth({ username: "user1", password: "pwd1111" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(host, "nim", now);

    const result = await viewGame(game.gameId, host);
    expect(result.isPlayer).toBe(true);
    expect(result.view).toBeNull();
    expect(result.players).toHaveLength(1);
  });

  it("returns a tagged view for a player in an active game", async () => {
    const host = await enforceAuth({ username: "user1", password: "pwd1111" });
    const joiner = await enforceAuth({ username: "user2", password: "pwd2222" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(host, "nim", now);
    await joinGame(game.gameId, joiner);
    await startGame(game.gameId, host);

    const result = await viewGame(game.gameId, host);
    expect(result.isPlayer).toBe(true);
    expect(result.view).not.toBeNull();
    expect(result.view?.type).toBe("nim");
  });

  it("returns isPlayer=false and a watcher view for a non-player in an active game", async () => {
    const host = await enforceAuth({ username: "user1", password: "pwd1111" });
    const joiner = await enforceAuth({ username: "user2", password: "pwd2222" });
    const watcher = await enforceAuth({ username: "user3", password: "pwd3333" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(host, "nim", now);
    await joinGame(game.gameId, joiner);
    await startGame(game.gameId, host);

    const result = await viewGame(game.gameId, watcher);
    expect(result.isPlayer).toBe(false);
    expect(result.view?.type).toBe("nim");
  });

  it("throws when the game does not exist", async () => {
    const user = await enforceAuth({ username: "user1", password: "pwd1111" });
    await expect(viewGame("nonexistent-id", user)).rejects.toThrow("viewed an invalid game id");
  });
});
