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
    expect(monopolyLogic.describeMove(state, resolved!, { type: "roll" }, 0)).toContain(
      "went to Jail",
    );
  });

  it("resolves a Chance teleport card and advances to Illinois Avenue", () => {
    const state = makeState();
    state.players[0].position = 15;
    state.chanceCursor = 1;

    const resolved = resolveMonopolyTurn(state, 0, [3, 4]);
    expect(resolved).not.toBeNull();
    expect(resolved!.players[0].position).toBe(24);
    expect(resolved!.chanceCursor).toBe(2);
    expect(resolved!.lastTurnEvents).toContainEqual(
      expect.objectContaining({
        type: "drew_card",
        deck: "chance",
        cardText: "Advance to Illinois Avenue",
      }),
    );
    expect(resolved!.lastTurnEvents).toContainEqual(
      expect.objectContaining({
        type: "teleported",
        to: 24,
        destinationName: "Illinois Avenue",
        reason: "chance",
      }),
    );
  });

  it("resolves a go-back-three card and applies the destination effect", () => {
    const state = makeState();
    state.chanceCursor = 8;

    const resolved = resolveMonopolyTurn(state, 0, [3, 4]);
    expect(resolved).not.toBeNull();
    expect(resolved!.players[0].position).toBe(4);
    expect(resolved!.players[0].money).toBe(1300);
    expect(resolved!.lastTurnEvents).toContainEqual(
      expect.objectContaining({
        type: "drew_card",
        cardText: "Go Back 3 Spaces",
      }),
    );
    expect(resolved!.lastTurnEvents).toContainEqual(
      expect.objectContaining({
        type: "paid_tax",
        amount: 200,
      }),
    );
  });

  it("resolves a Community Chest go-to-jail card", () => {
    const state = makeState();
    state.players[0].position = 31;
    state.communityChestCursor = 1;

    const resolved = resolveMonopolyTurn(state, 0, [1, 1]);
    expect(resolved).not.toBeNull();
    expect(resolved!.players[0].position).toBe(10);
    expect(resolved!.players[0].inJail).toBe(true);
    expect(resolved!.communityChestCursor).toBe(2);
    expect(resolved!.lastTurnEvents).toContainEqual(
      expect.objectContaining({
        type: "drew_card",
        deck: "community_chest",
        cardText: "Go to Jail",
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
    expect(monopolyLogic.describeMove(state, resolved!, { type: "roll" }, 0)).toBe(
      " rolled 1 + 1, moved to Income Tax, landed on Income Tax, paid $200 in tax",
    );
  });

  it("describes card-driven turns with deck and destination details", () => {
    const state = makeState();
    state.players[0].position = 15;
    state.chanceCursor = 1;

    const resolved = resolveMonopolyTurn(state, 0, [3, 4]);
    expect(resolved).not.toBeNull();
    expect(monopolyLogic.describeMove(state, resolved!, { type: "roll" }, 0)).toContain(
      'drew Chance card "Advance to Illinois Avenue"',
    );
    expect(monopolyLogic.describeMove(state, resolved!, { type: "roll" }, 0)).toContain(
      "moved to Illinois Avenue",
    );
  });
});
