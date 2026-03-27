import { describe, expect, it } from "vitest";
import { type MonopolyGameState } from "@gamenite/shared";
import { applyCardEffect, monopolyLogic, resolveMonopolyTurn } from "../../src/games/monopoly.ts";

function makeState(playerCount = 2): MonopolyGameState {
  return monopolyLogic.start(playerCount);
}

describe("Monopoly start() logic", () => {
  it("starts players at Go with money, empty events, and deck cursors", () => {
    expect(monopolyLogic.start(2)).toStrictEqual({
      players: [
        { money: 1500, position: 0, isBankrupt: false, inJail: false, jailTurns: 0 },
        { money: 1500, position: 0, isBankrupt: false, inJail: false, jailTurns: 0 },
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

  it("supports four-player Monopoly state creation", () => {
    const state = monopolyLogic.start(4);
    expect(state.players).toHaveLength(4);
    expect(state.players).toStrictEqual([
      { money: 1500, position: 0, isBankrupt: false, inJail: false, jailTurns: 0 },
      { money: 1500, position: 0, isBankrupt: false, inJail: false, jailTurns: 0 },
      { money: 1500, position: 0, isBankrupt: false, inJail: false, jailTurns: 0 },
      { money: 1500, position: 0, isBankrupt: false, inJail: false, jailTurns: 0 },
    ]);
  });
});

describe("Monopoly update() logic", () => {
  it("rejects invalid moves and wrong-player moves", () => {
    const state = makeState();
    expect(monopolyLogic.update(state, { type: "buy" }, 0)).toBeNull();
    expect(monopolyLogic.update(state, { type: "roll" }, 1)).toBeNull();
    expect(monopolyLogic.update(state, { type: "pay_bail" }, 0)).toBeNull();
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
    expect(resolved!.players[0].jailTurns).toBe(0);
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

  it("keeps a player in jail after a non-doubles roll", () => {
    const state = makeState();
    state.players[0].position = 10;
    state.players[0].inJail = true;

    const resolved = resolveMonopolyTurn(state, 0, [1, 2]);
    expect(resolved).not.toBeNull();
    expect(resolved!.players[0]).toMatchObject({
      position: 10,
      inJail: true,
      jailTurns: 1,
      money: 1500,
    });
    expect(resolved!.currentPlayerIndex).toBe(1);
    expect(resolved!.lastTurnEvents).toStrictEqual([
      { type: "rolled", dice: [1, 2] },
      { type: "stayed_in_jail", turnsRemaining: 2 },
    ]);
  });

  it("lets a jailed player leave by rolling doubles and move on the same turn", () => {
    const state = makeState();
    state.players[0].position = 10;
    state.players[0].inJail = true;
    state.players[0].jailTurns = 1;

    const resolved = resolveMonopolyTurn(state, 0, [2, 2]);
    expect(resolved).not.toBeNull();
    expect(resolved!.players[0]).toMatchObject({
      position: 14,
      inJail: false,
      jailTurns: 0,
    });
    expect(resolved!.lastTurnEvents).toContainEqual({
      type: "left_jail",
      method: "rolled_doubles",
    });
  });

  it("supports paying bail to leave jail and move immediately", () => {
    const state = makeState();
    state.players[0].position = 10;
    state.players[0].inJail = true;
    state.players[0].jailTurns = 1;

    const resolved = resolveMonopolyTurn(state, 0, [1, 1], "pay_bail");
    expect(resolved).not.toBeNull();
    expect(resolved!.players[0]).toMatchObject({
      position: 12,
      inJail: false,
      jailTurns: 0,
      money: 1450,
    });
    expect(resolved!.lastTurnEvents.slice(0, 3)).toStrictEqual([
      { type: "paid_bail", amount: 50, automatic: false },
      { type: "left_jail", method: "paid_bail" },
      { type: "rolled", dice: [1, 1] },
    ]);
  });

  it("automatically charges bail on the third failed jail roll and moves the player", () => {
    const state = makeState();
    state.players[0].position = 10;
    state.players[0].inJail = true;
    state.players[0].jailTurns = 2;

    const resolved = resolveMonopolyTurn(state, 0, [1, 2]);
    expect(resolved).not.toBeNull();
    expect(resolved!.players[0]).toMatchObject({
      position: 13,
      inJail: false,
      jailTurns: 0,
      money: 1450,
    });
    expect(resolved!.lastTurnEvents).toContainEqual({
      type: "paid_bail",
      amount: 50,
      automatic: true,
    });
    expect(resolved!.lastTurnEvents).toContainEqual({
      type: "left_jail",
      method: "automatic_bail",
    });
  });

  it("rotates turns correctly across four players", () => {
    let state = makeState(4);

    state = resolveMonopolyTurn(state, 0, [1, 2])!;
    expect(state.currentPlayerIndex).toBe(1);
    state = resolveMonopolyTurn(state, 1, [1, 2])!;
    expect(state.currentPlayerIndex).toBe(2);
    state = resolveMonopolyTurn(state, 2, [1, 2])!;
    expect(state.currentPlayerIndex).toBe(3);
    state = resolveMonopolyTurn(state, 3, [1, 2])!;
    expect(state.currentPlayerIndex).toBe(0);
    expect(state.players.map((player) => player.position)).toStrictEqual([3, 3, 3, 3]);
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
      " rolled 2, moved to Income Tax, landed on Income Tax, paid $200 in tax",
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

  it("describes failed and paid jail turns clearly", () => {
    const state = makeState();
    state.players[0].position = 10;
    state.players[0].inJail = true;

    const failedRoll = resolveMonopolyTurn(state, 0, [1, 2]);
    expect(failedRoll).not.toBeNull();
    expect(monopolyLogic.describeMove(state, failedRoll!, { type: "roll" }, 0)).toBe(
      " rolled 1 + 2, stayed in Jail (2 turns remaining)",
    );

    const bailedState = makeState();
    bailedState.players[0].position = 10;
    bailedState.players[0].inJail = true;
    const paidBail = resolveMonopolyTurn(bailedState, 0, [1, 1], "pay_bail");
    expect(paidBail).not.toBeNull();
    expect(monopolyLogic.describeMove(bailedState, paidBail!, { type: "pay_bail" }, 0)).toContain(
      "paid $50 bail",
    );
  });
});
