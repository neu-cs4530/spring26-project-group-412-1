import { afterEach, describe, expect, it, vi } from "vitest";
import { type MonopolyGameState, type OwnableSpace } from "@gamenite/shared";
import { applyCardEffect, monopolyLogic, resolveMonopolyTurn } from "../../src/games/monopoly.ts";

function makeState(playerCount = 2): MonopolyGameState {
  return monopolyLogic.start(playerCount);
}

function ownableSpace(state: MonopolyGameState, spaceId: number): OwnableSpace {
  const space = state.board.find((candidate) => candidate.spaceId === spaceId);
  if (!space || (space.type !== "property" && space.type !== "railroad" && space.type !== "utility")) {
    throw new Error(`Expected ownable space ${spaceId}`);
  }
  return space;
}

function propertySpace(state: MonopolyGameState, spaceId: number) {
  const space = ownableSpace(state, spaceId);
  if (space.type !== "property") {
    throw new Error(`Expected property space ${spaceId}`);
  }
  return space;
}

function mockDice(dice: [number, number]) {
  return vi
    .spyOn(Math, "random")
    .mockReturnValueOnce((dice[0] - 0.5) / 6)
    .mockReturnValueOnce((dice[1] - 0.5) / 6);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Monopoly start() logic", () => {
  it("starts players with the full Monopoly state machine initialized", () => {
    expect(monopolyLogic.start(2)).toMatchObject({
      players: [
        {
          money: 1500,
          position: 0,
          isBankrupt: false,
          inJail: false,
          jailTurns: 0,
          chanceGetOutOfJailFreeCards: 0,
          communityChestGetOutOfJailFreeCards: 0,
        },
        {
          money: 1500,
          position: 0,
          isBankrupt: false,
          inJail: false,
          jailTurns: 0,
          chanceGetOutOfJailFreeCards: 0,
          communityChestGetOutOfJailFreeCards: 0,
        },
      ],
      board: expect.any(Array),
      currentPlayerIndex: 0,
      phase: "playing",
      turnPhase: "awaiting_roll",
      pendingPropertyId: undefined,
      extraTurn: false,
      consecutiveDoubles: 0,
      diceRoll: undefined,
      winnerIndex: undefined,
      chanceCursor: 0,
      communityChestCursor: 0,
      chanceGetOutOfJailFreeAvailable: true,
      communityChestGetOutOfJailFreeAvailable: true,
      lastTurnEvents: [],
    });
  });

  it("fills property cards with detailed rent and mortgage metadata", () => {
    const state = monopolyLogic.start(2);

    expect(ownableSpace(state, 1)).toMatchObject({
      mortgageValue: 30,
      houseCost: 50,
      rentSchedule: [2, 10, 30, 90, 160, 250],
    });
    expect(ownableSpace(state, 5)).toMatchObject({
      mortgageValue: 100,
      railroadRentSchedule: [25, 50, 100, 200],
    });
    expect(ownableSpace(state, 12)).toMatchObject({
      mortgageValue: 75,
      utilityMultiplierSchedule: [4, 10],
    });
  });
});

describe("Monopoly update() routing", () => {
  it("rejects invalid moves and wrong-player turns", () => {
    const state = makeState();

    expect(monopolyLogic.update(state, { type: "buy" }, 0)).toBeNull();
    expect(monopolyLogic.update(state, { type: "roll" }, 1)).toBeNull();
    expect(monopolyLogic.update(state, { type: "pay_bail" }, 0)).toBeNull();
    expect(monopolyLogic.update(state, { type: "end_turn" }, 0)).toBeNull();
  });

  it("routes a roll into an explicit purchase decision when landing on an available property", () => {
    const state = makeState();
    mockDice([1, 2]);

    const resolved = monopolyLogic.update(state, { type: "roll" }, 0);

    expect(resolved).not.toBeNull();
    expect(resolved).toMatchObject({
      currentPlayerIndex: 0,
      turnPhase: "awaiting_purchase",
      pendingPropertyId: 3,
      extraTurn: false,
    });
    expect(resolved?.lastTurnEvents).toContainEqual(
      expect.objectContaining({
        type: "property_available",
        spaceId: 3,
        spaceName: "Baltic Avenue",
        price: 60,
      }),
    );
  });

  it("supports buying a property and ending the turn through the public update API", () => {
    const state = makeState();
    mockDice([1, 2]);
    const rolled = monopolyLogic.update(state, { type: "roll" }, 0);
    if (!rolled) throw new Error("Expected roll to succeed");

    const bought = monopolyLogic.update(rolled, { type: "buy_property" }, 0);
    if (!bought) throw new Error("Expected property purchase to succeed");

    expect(ownableSpace(bought, 3).ownerIndex).toBe(0);
    expect(bought.players[0].money).toBe(1440);
    expect(bought.turnPhase).toBe("awaiting_end_turn");
    expect(bought.lastTurnEvents).toStrictEqual([
      {
        type: "property_purchased",
        spaceId: 3,
        spaceName: "Baltic Avenue",
        price: 60,
      },
    ]);

    const ended = monopolyLogic.update(bought, { type: "end_turn" }, 0);
    expect(ended).not.toBeNull();
    expect(ended).toMatchObject({
      currentPlayerIndex: 1,
      turnPhase: "awaiting_roll",
      extraTurn: false,
      consecutiveDoubles: 0,
    });
  });
});

describe("Monopoly turn and rule resolution", () => {
  it("charges double base rent on an unimproved color-group monopoly", () => {
    const state = makeState();
    ownableSpace(state, 1).ownerIndex = 1;
    ownableSpace(state, 3).ownerIndex = 1;
    state.players[0].position = 0;
    state.lastTurnEvents = [];

    applyCardEffect(state, 0, { type: "move_to_space", spaceId: 1 }, "chance", state.lastTurnEvents);

    expect(state.players[0].money).toBe(1496);
    expect(state.players[1].money).toBe(1504);
    expect(state.lastTurnEvents).toContainEqual(
      expect.objectContaining({
        type: "paid_rent",
        amount: 4,
        spaceId: 1,
        spaceName: "Mediterranean Avenue",
      }),
    );
  });

  it("preserves an extra turn through a property decision after rolling doubles", () => {
    const state = makeState();
    state.players[0].position = 6;

    const rolled = resolveMonopolyTurn(state, 0, [1, 1]);
    if (!rolled) throw new Error("Expected doubles turn to resolve");

    expect(rolled).toMatchObject({
      currentPlayerIndex: 0,
      turnPhase: "awaiting_purchase",
      pendingPropertyId: 8,
      extraTurn: true,
      consecutiveDoubles: 1,
    });

    const passed = monopolyLogic.update(rolled, { type: "pass_property" }, 0);
    expect(passed).not.toBeNull();
    expect(passed).toMatchObject({
      currentPlayerIndex: 0,
      turnPhase: "awaiting_roll",
      extraTurn: true,
      pendingPropertyId: undefined,
      consecutiveDoubles: 1,
    });
  });

  it("collects rent on owned properties", () => {
    const state = makeState();
    ownableSpace(state, 3).ownerIndex = 1;

    const resolved = resolveMonopolyTurn(state, 0, [1, 2]);

    expect(resolved).not.toBeNull();
    expect(resolved?.players[0].money).toBe(1496);
    expect(resolved?.players[1].money).toBe(1504);
    expect(resolved?.turnPhase).toBe("awaiting_end_turn");
    expect(resolved?.lastTurnEvents).toContainEqual(
      expect.objectContaining({
        type: "paid_rent",
        amount: 4,
        spaceId: 3,
        spaceName: "Baltic Avenue",
        ownerIndex: 1,
      }),
    );
  });

  it("uses the railroad rent multiplier from Chance cards", () => {
    const state = makeState();
    ownableSpace(state, 5).ownerIndex = 1;
    state.players[0].position = 4;
    state.lastTurnEvents = [];

    applyCardEffect(
      state,
      0,
      { type: "move_to_nearest", spaceType: "railroad", rentMultiplier: 2 },
      "chance",
      state.lastTurnEvents,
    );

    expect(state.players[0].position).toBe(5);
    expect(state.players[0].money).toBe(1450);
    expect(state.players[1].money).toBe(1550);
    expect(state.lastTurnEvents).toContainEqual(
      expect.objectContaining({
        type: "paid_rent",
        amount: 50,
        spaceId: 5,
        spaceName: "Reading Railroad",
        ownerIndex: 1,
      }),
    );
  });

  it("uses the utility rent override from Chance cards", () => {
    const state = makeState();
    ownableSpace(state, 12).ownerIndex = 1;
    state.players[0].position = 7;
    state.diceRoll = [3, 4];
    state.lastTurnEvents = [];

    applyCardEffect(
      state,
      0,
      { type: "move_to_nearest", spaceType: "utility", utilityMultiplierOverride: 10 },
      "chance",
      state.lastTurnEvents,
    );

    expect(state.players[0].position).toBe(12);
    expect(state.players[0].money).toBe(1430);
    expect(state.players[1].money).toBe(1570);
    expect(state.lastTurnEvents).toContainEqual(
      expect.objectContaining({
        type: "paid_rent",
        amount: 70,
        spaceId: 12,
        spaceName: "Electric Company",
        ownerIndex: 1,
      }),
    );
  });

  it("sends a player to jail after a third consecutive doubles roll", () => {
    const state = makeState();
    state.consecutiveDoubles = 2;

    const resolved = resolveMonopolyTurn(state, 0, [2, 2]);

    expect(resolved).not.toBeNull();
    expect(resolved).toMatchObject({
      currentPlayerIndex: 1,
      turnPhase: "awaiting_roll",
      consecutiveDoubles: 0,
    });
    expect(resolved?.players[0]).toMatchObject({
      position: 10,
      inJail: true,
      jailTurns: 0,
    });
    expect(resolved?.lastTurnEvents).toContainEqual(
      expect.objectContaining({
        type: "sent_to_jail",
        to: 10,
      }),
    );
  });

  it("keeps a player in jail after a non-doubles roll", () => {
    const state = makeState();
    state.players[0].position = 10;
    state.players[0].inJail = true;

    const resolved = resolveMonopolyTurn(state, 0, [1, 2]);

    expect(resolved).not.toBeNull();
    expect(resolved?.players[0]).toMatchObject({
      position: 10,
      inJail: true,
      jailTurns: 1,
      money: 1500,
    });
    expect(resolved?.currentPlayerIndex).toBe(1);
    expect(resolved?.lastTurnEvents).toStrictEqual([
      { type: "rolled", dice: [1, 2] },
      { type: "stayed_in_jail", turnsRemaining: 2 },
    ]);
  });

  it("lets a jailed player leave with a Get Out of Jail Free card and restores card availability", () => {
    const state = makeState();
    state.players[0].position = 10;
    state.players[0].inJail = true;
    state.players[0].chanceGetOutOfJailFreeCards = 1;
    state.chanceGetOutOfJailFreeAvailable = false;

    const resolved = resolveMonopolyTurn(state, 0, [1, 2], "use_get_out_of_jail_card");

    expect(resolved).not.toBeNull();
    expect(resolved?.players[0]).toMatchObject({
      position: 13,
      inJail: false,
      jailTurns: 0,
      chanceGetOutOfJailFreeCards: 0,
    });
    expect(resolved?.chanceGetOutOfJailFreeAvailable).toBe(true);
    expect(resolved?.lastTurnEvents.slice(0, 3)).toStrictEqual([
      { type: "used_get_out_of_jail_card", deck: "chance" },
      { type: "left_jail", method: "paid_bail" },
      { type: "rolled", dice: [1, 2] },
    ]);
  });

  it("automatically charges bail on the third failed jail roll and moves the player", () => {
    const state = makeState();
    state.players[0].position = 10;
    state.players[0].inJail = true;
    state.players[0].jailTurns = 2;

    const resolved = resolveMonopolyTurn(state, 0, [1, 2]);

    expect(resolved).not.toBeNull();
    expect(resolved?.players[0]).toMatchObject({
      position: 13,
      inJail: false,
      jailTurns: 0,
      money: 1450,
    });
    expect(resolved?.lastTurnEvents).toContainEqual({
      type: "paid_bail",
      amount: 50,
      automatic: true,
    });
    expect(resolved?.lastTurnEvents).toContainEqual({
      type: "left_jail",
      method: "automatic_bail",
    });
  });

  it("bankrupts a player on unpaid rent and finishes the game with one winner", () => {
    const state = makeState();
    state.players[0].money = 3;
    ownableSpace(state, 3).ownerIndex = 1;

    const resolved = resolveMonopolyTurn(state, 0, [1, 2]);

    expect(resolved).not.toBeNull();
    expect(resolved).toMatchObject({
      phase: "finished",
      winnerIndex: 1,
      turnPhase: "awaiting_end_turn",
    });
    expect(resolved?.players[0]).toMatchObject({
      money: 0,
      isBankrupt: true,
    });
    expect(resolved?.players[1].money).toBe(1503);
    expect(resolved?.lastTurnEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "paid_rent",
          amount: 3,
          spaceName: "Baltic Avenue",
        }),
        expect.objectContaining({
          type: "bankruptcy",
          playerIndex: 0,
          creditorIndex: 1,
          reason: "Baltic Avenue rent",
        }),
        expect.objectContaining({
          type: "won_game",
          winnerIndex: 1,
        }),
      ]),
    );
  });

  it("does not collect rent from mortgaged properties", () => {
    const state = makeState();
    ownableSpace(state, 3).ownerIndex = 1;
    ownableSpace(state, 3).mortgaged = true;

    const resolved = resolveMonopolyTurn(state, 0, [1, 2]);

    expect(resolved).not.toBeNull();
    expect(resolved?.players[0].money).toBe(1500);
    expect(resolved?.players[1].money).toBe(1500);
    expect(resolved?.lastTurnEvents.some((event) => event.type === "paid_rent")).toBe(false);
  });
});

describe("Monopoly property management", () => {
  it("builds houses evenly across a monopoly set", () => {
    const state = makeState();
    ownableSpace(state, 1).ownerIndex = 0;
    ownableSpace(state, 3).ownerIndex = 0;
    state.turnPhase = "awaiting_end_turn";

    const firstHouse = monopolyLogic.update(state, { type: "build_house", spaceId: 1 }, 0);
    expect(firstHouse).not.toBeNull();
    expect(ownableSpace(firstHouse!, 1)).toMatchObject({
      houseCount: 1,
      hotelCount: 0,
    });
    expect(firstHouse?.players[0].money).toBe(1450);
    expect(firstHouse?.lastTurnEvents).toStrictEqual([
      {
        type: "built_house",
        spaceId: 1,
        spaceName: "Mediterranean Avenue",
        houseCount: 1,
        amount: 50,
      },
    ]);

    expect(monopolyLogic.update(firstHouse!, { type: "build_house", spaceId: 1 }, 0)).toBeNull();

    const matchingHouse = monopolyLogic.update(firstHouse!, { type: "build_house", spaceId: 3 }, 0);
    expect(matchingHouse).not.toBeNull();
    expect(ownableSpace(matchingHouse!, 3)).toMatchObject({
      houseCount: 1,
    });
  });

  it("upgrades four houses into a hotel", () => {
    const state = makeState();
    ownableSpace(state, 1).ownerIndex = 0;
    ownableSpace(state, 3).ownerIndex = 0;
    propertySpace(state, 1).houseCount = 4;
    propertySpace(state, 3).houseCount = 4;
    state.turnPhase = "awaiting_end_turn";

    const resolved = monopolyLogic.update(state, { type: "build_hotel", spaceId: 1 }, 0);

    expect(resolved).not.toBeNull();
    expect(ownableSpace(resolved!, 1)).toMatchObject({
      houseCount: 0,
      hotelCount: 1,
    });
    expect(resolved?.players[0].money).toBe(1450);
    expect(resolved?.lastTurnEvents).toStrictEqual([
      {
        type: "built_hotel",
        spaceId: 1,
        spaceName: "Mediterranean Avenue",
        amount: 50,
      },
    ]);
  });

  it("mortgages and unmortgages an owned property with 10 percent interest", () => {
    const state = makeState();
    ownableSpace(state, 5).ownerIndex = 0;
    state.turnPhase = "awaiting_end_turn";

    const mortgaged = monopolyLogic.update(state, { type: "mortgage_property", spaceId: 5 }, 0);
    expect(mortgaged).not.toBeNull();
    expect(ownableSpace(mortgaged!, 5).mortgaged).toBe(true);
    expect(mortgaged?.players[0].money).toBe(1600);
    expect(mortgaged?.lastTurnEvents).toStrictEqual([
      {
        type: "mortgaged_property",
        spaceId: 5,
        spaceName: "Reading Railroad",
        amount: 100,
      },
    ]);

    const unmortgaged = monopolyLogic.update(
      mortgaged!,
      { type: "unmortgage_property", spaceId: 5 },
      0,
    );
    expect(unmortgaged).not.toBeNull();
    expect(ownableSpace(unmortgaged!, 5).mortgaged).toBe(false);
    expect(unmortgaged?.players[0].money).toBe(1490);
    expect(unmortgaged?.lastTurnEvents).toStrictEqual([
      {
        type: "unmortgaged_property",
        spaceId: 5,
        spaceName: "Reading Railroad",
        amount: 110,
      },
    ]);
  });

  it("blocks mortgaging a property when its color group has buildings", () => {
    const state = makeState();
    ownableSpace(state, 1).ownerIndex = 0;
    ownableSpace(state, 3).ownerIndex = 0;
    propertySpace(state, 1).houseCount = 1;
    state.turnPhase = "awaiting_end_turn";

    expect(monopolyLogic.update(state, { type: "mortgage_property", spaceId: 3 }, 0)).toBeNull();
  });

  it("blocks building houses while a property in the set is mortgaged", () => {
    const state = makeState();
    ownableSpace(state, 1).ownerIndex = 0;
    ownableSpace(state, 3).ownerIndex = 0;
    ownableSpace(state, 3).mortgaged = true;
    state.turnPhase = "awaiting_end_turn";

    expect(monopolyLogic.update(state, { type: "build_house", spaceId: 1 }, 0)).toBeNull();
  });
});

describe("Monopoly card and move descriptions", () => {
  it("draws a Get Out of Jail Free card and marks it unavailable in the deck", () => {
    const state = makeState();
    state.players[0].position = 5;
    state.chanceCursor = 11;

    const resolved = resolveMonopolyTurn(state, 0, [1, 1]);

    expect(resolved).not.toBeNull();
    expect(resolved?.players[0].chanceGetOutOfJailFreeCards).toBe(1);
    expect(resolved?.chanceGetOutOfJailFreeAvailable).toBe(false);
    expect(resolved?.lastTurnEvents).toContainEqual({
      type: "received_get_out_of_jail_card",
      deck: "chance",
    });
  });

  it("describes purchase, bankruptcy, and end-turn actions clearly", () => {
    const purchaseState = makeState();
    mockDice([1, 2]);
    const rolled = monopolyLogic.update(purchaseState, { type: "roll" }, 0);
    if (!rolled) throw new Error("Expected roll to succeed");
    const bought = monopolyLogic.update(rolled, { type: "buy_property" }, 0);
    if (!bought) throw new Error("Expected purchase to succeed");

    expect(monopolyLogic.describeMove(rolled, bought, { type: "buy_property" }, 0)).toBe(
      " bought Baltic Avenue for $60",
    );

    const bankruptState = makeState();
    bankruptState.players[0].money = 3;
    ownableSpace(bankruptState, 3).ownerIndex = 1;
    const bankruptTurn = resolveMonopolyTurn(bankruptState, 0, [1, 2]);
    if (!bankruptTurn) throw new Error("Expected bankruptcy turn to resolve");
    expect(monopolyLogic.describeMove(bankruptState, bankruptTurn, { type: "roll" }, 0)).toContain(
      "went bankrupt from Baltic Avenue rent",
    );
    expect(monopolyLogic.describeMove(bankruptState, bankruptTurn, { type: "roll" }, 0)).toContain(
      "won the game",
    );

    expect(monopolyLogic.describeMove(bought, monopolyLogic.update(bought, { type: "end_turn" }, 0)!, { type: "end_turn" }, 0)).toBe(
      " ended their turn",
    );
  });

  it("describes building and mortgage actions clearly", () => {
    const houseState = makeState();
    ownableSpace(houseState, 1).ownerIndex = 0;
    ownableSpace(houseState, 3).ownerIndex = 0;
    houseState.turnPhase = "awaiting_end_turn";

    const builtHouse = monopolyLogic.update(houseState, { type: "build_house", spaceId: 1 }, 0);
    if (!builtHouse) throw new Error("Expected house build to succeed");
    expect(
      monopolyLogic.describeMove(houseState, builtHouse, { type: "build_house", spaceId: 1 }, 0),
    ).toBe(" built house #1 on Mediterranean Avenue for $50");

    const mortgageState = makeState();
    ownableSpace(mortgageState, 5).ownerIndex = 0;
    mortgageState.turnPhase = "awaiting_end_turn";
    const mortgaged = monopolyLogic.update(
      mortgageState,
      { type: "mortgage_property", spaceId: 5 },
      0,
    );
    if (!mortgaged) throw new Error("Expected mortgage to succeed");
    expect(
      monopolyLogic.describeMove(
        mortgageState,
        mortgaged,
        { type: "mortgage_property", spaceId: 5 },
        0,
      ),
    ).toBe(" mortgaged Reading Railroad for $100");
  });
});
