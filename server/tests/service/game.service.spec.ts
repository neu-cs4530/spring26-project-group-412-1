import { describe, expect, it } from "vitest";
import { enforceAuth } from "../../src/services/auth.service.ts";
import { createGame, getGameById, joinGame, startGame } from "../../src/services/game.service.ts";

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
