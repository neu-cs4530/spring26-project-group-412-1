import { describe, expect, it } from "vitest";
import { type MonopolyGameState } from "@gamenite/shared";
import { applyCardEffect, monopolyLogic, resolveMonopolyTurn } from "../../src/games/monopoly.ts";

function makeState(): MonopolyGameState {
  return monopolyLogic.start(2);
}

describe("Monopoly start() logic", () => {
  it("starts players at Go with money, empty events, and deck cursors", () => {
    expect(monopolyLogic.start(2)).toStrictEqual({
      players: [
        { money: 1500, position: 0, isBankrupt: false, inJail: false },
        { money: 1500, position: 0, isBankrupt: false, inJail: false },
      ],
      board: expect.any(Array),
      currentPlayerIndex: 0,
      phase: "playing",
      diceRoll: undefined,
      winnerIndex: undefined,
      chanceCursor: 0,
      communityChestCursor: 0,
      lastTurnEvents: [],
    });
  });
});

describe("Monopoly update() logic", () => {
  it("rejects invalid moves and wrong-player moves", () => {
    const state = makeState();
    expect(monopolyLogic.update(state, { type: "buy" }, 0)).toBeNull();
    expect(monopolyLogic.update(state, { type: "roll" }, 1)).toBeNull();
  });
});

describe("Monopoly turn resolution", () => {
  it("moves the current player, records events, and advances the turn", () => {
    const state = makeState();

    const resolved = resolveMonopolyTurn(state, 0, [1, 2]);
    expect(resolved).not.toBeNull();
    expect(resolved!.players[0].position).toBe(3);
    expect(resolved!.diceRoll).toStrictEqual([1, 2]);
    expect(resolved!.currentPlayerIndex).toBe(1);
    expect(resolved!.lastTurnEvents.map((event) => event.type)).toStrictEqual([
      "rolled",
      "moved",
      "landed",
    ]);
  });

  it("applies tax spaces through the landing resolver", () => {
    const state = makeState();
    state.players[0].position = 2;

    const resolved = resolveMonopolyTurn(state, 0, [1, 1]);
    expect(resolved).not.toBeNull();
    expect(resolved!.players[0].position).toBe(4);
    expect(resolved!.players[0].money).toBe(1300);
    expect(resolved!.lastTurnEvents).toContainEqual(
      expect.objectContaining({
        type: "paid_tax",
        amount: 200,
        spaceName: "Income Tax",
      }),
    );
  });

  it("sends players to jail through the landing resolver", () => {
    const state = makeState();
    state.players[0].position = 23;

    const resolved = resolveMonopolyTurn(state, 0, [3, 4]);
    expect(resolved).not.toBeNull();
    expect(resolved!.players[0].position).toBe(10);
    expect(resolved!.players[0].inJail).toBe(true);
    expect(resolved!.lastTurnEvents).toContainEqual(
      expect.objectContaining({
        type: "sent_to_jail",
        to: 10,
      }),
    );
  });
});

describe("Monopoly card helpers", () => {
  it("can teleport a player to an exact destination", () => {
    const state = makeState();
    state.players[0].position = 7;
    state.lastTurnEvents = [];

    applyCardEffect(
      state,
      0,
      { type: "move_to_space", spaceId: 0 },
      "chance",
      state.lastTurnEvents,
    );

    expect(state.players[0].position).toBe(0);
    expect(state.players[0].money).toBe(1700);
    expect(state.lastTurnEvents).toContainEqual(
      expect.objectContaining({
        type: "teleported",
        to: 0,
        destinationName: "Go",
        reason: "chance",
      }),
    );
  });

  it("can move a player to the nearest matching space and award pass-go money on wrap", () => {
    const state = makeState();
    state.players[0].position = 29;
    state.lastTurnEvents = [];

    applyCardEffect(
      state,
      0,
      { type: "move_to_nearest", spaceType: "utility" },
      "chance",
      state.lastTurnEvents,
    );

    expect(state.players[0].position).toBe(12);
    expect(state.players[0].money).toBe(1700);
    expect(state.lastTurnEvents).toContainEqual(
      expect.objectContaining({
        type: "passed_go",
        amount: 200,
      }),
    );
  });
});

describe("Monopoly move descriptions", () => {
  it("builds chat-safe descriptions from last-turn events", () => {
    const state = makeState();
    state.players[0].position = 2;

    const resolved = resolveMonopolyTurn(state, 0, [1, 1]);
    expect(resolved).not.toBeNull();
    expect(monopolyLogic.describeMove(state, resolved!, { type: "roll" }, 0)).toContain(
      "paid $200 in tax",
    );
  });
});
