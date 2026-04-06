import { GameService } from "./gameServiceManager.ts";
import {
  type BoardSpace,
  type MonopolyCard,
  type MonopolyCardEffect,
  type MonopolyDeckKind,
  type MonopolyGameState,
  type MonopolyMove,
  type MonopolyPlayer,
  type MonopolyTurnEvent,
  zMonopolyMove,
} from "@gamenite/shared";
import { type GameLogic } from "./gameLogic.ts";

const STARTING_MONEY = 1500;
const GO_MONEY = 200;
const BOARD_SIZE = 40;
const JAIL_SPACE_ID = 10;
const BAIL_AMOUNT = 50;
const MAX_JAIL_TURNS = 3;

function propertySpace(
  spaceId: number,
  name: string,
  price: number,
  colorGroup: string,
  houseCost: number,
  rentSchedule: [number, number, number, number, number, number],
): BoardSpace {
  return {
    spaceId,
    name,
    type: "property",
    price,
    rent: rentSchedule[0],
    colorGroup,
    houseCost,
    mortgageValue: price / 2,
    rentSchedule,
  };
}

function railroadSpace(spaceId: number, name: string): BoardSpace {
  return {
    spaceId,
    name,
    type: "railroad",
    price: 200,
    rent: 25,
    mortgageValue: 100,
    railroadRentSchedule: [25, 50, 100, 200],
  };
}

function utilitySpace(spaceId: number, name: string): BoardSpace {
  return {
    spaceId,
    name,
    type: "utility",
    price: 150,
    rent: 4,
    mortgageValue: 75,
    utilityMultiplierSchedule: [4, 10],
  };
}

const CHANCE_DECK: MonopolyCard[] = [
  {
    id: "chance-advance-go",
    deck: "chance",
    text: "Advance to Go",
    effect: { type: "move_to_space", spaceId: 0 },
  },
  {
    id: "chance-advance-illinois",
    deck: "chance",
    text: "Advance to Illinois Avenue",
    effect: { type: "move_to_space", spaceId: 24 },
  },
  {
    id: "chance-advance-st-charles",
    deck: "chance",
    text: "Advance to St. Charles Place",
    effect: { type: "move_to_space", spaceId: 11 },
  },
  {
    id: "chance-nearest-railroad-1",
    deck: "chance",
    text: "Advance token to nearest Railroad",
    effect: { type: "move_to_nearest", spaceType: "railroad" },
  },
  {
    id: "chance-nearest-railroad-2",
    deck: "chance",
    text: "Advance token to nearest Railroad",
    effect: { type: "move_to_nearest", spaceType: "railroad" },
  },
  {
    id: "chance-nearest-utility",
    deck: "chance",
    text: "Advance token to nearest Utility",
    effect: { type: "move_to_nearest", spaceType: "utility" },
  },
  {
    id: "chance-reading-railroad",
    deck: "chance",
    text: "Take a trip to Reading Railroad",
    effect: { type: "move_to_space", spaceId: 5 },
  },
  {
    id: "chance-boardwalk",
    deck: "chance",
    text: "Take a walk on the Boardwalk",
    effect: { type: "move_to_space", spaceId: 39 },
  },
  {
    id: "chance-go-back-three",
    deck: "chance",
    text: "Go Back 3 Spaces",
    effect: { type: "move_by", spaces: -3 },
  },
  {
    id: "chance-go-to-jail",
    deck: "chance",
    text: "Go directly to Jail",
    effect: { type: "go_to_jail" },
  },
];

const COMMUNITY_CHEST_DECK: MonopolyCard[] = [
  {
    id: "community-advance-go",
    deck: "community_chest",
    text: "Advance to Go",
    effect: { type: "move_to_space", spaceId: 0 },
  },
  {
    id: "community-go-to-jail",
    deck: "community_chest",
    text: "Go to Jail",
    effect: { type: "go_to_jail" },
  },
];

/**
 * Initial board setup with all 40 Monopoly spaces.
 */
function createInitialBoard(): BoardSpace[] {
  return [
    { spaceId: 0, name: "Go", type: "go" },
    propertySpace(1, "Mediterranean Avenue", 60, "brown", 50, [2, 10, 30, 90, 160, 250]),
    { spaceId: 2, name: "Community Chest", type: "community_chest" },
    propertySpace(3, "Baltic Avenue", 60, "brown", 50, [4, 20, 60, 180, 320, 450]),
    { spaceId: 4, name: "Income Tax", type: "tax", amount: 200 },
    railroadSpace(5, "Reading Railroad"),
    propertySpace(6, "Oriental Avenue", 100, "lightblue", 50, [6, 30, 90, 270, 400, 550]),
    { spaceId: 7, name: "Chance", type: "chance" },
    propertySpace(8, "Vermont Avenue", 100, "lightblue", 50, [6, 30, 90, 270, 400, 550]),
    propertySpace(9, "Connecticut Avenue", 120, "lightblue", 50, [8, 40, 100, 300, 450, 600]),
    { spaceId: 10, name: "Jail", type: "jail" },
    propertySpace(11, "St. Charles Place", 140, "pink", 100, [10, 50, 150, 450, 625, 750]),
    utilitySpace(12, "Electric Company"),
    propertySpace(13, "States Avenue", 140, "pink", 100, [10, 50, 150, 450, 625, 750]),
    propertySpace(14, "Virginia Avenue", 160, "pink", 100, [12, 60, 180, 500, 700, 900]),
    railroadSpace(15, "Pennsylvania Railroad"),
    propertySpace(16, "St. James Place", 180, "orange", 100, [14, 70, 200, 550, 750, 950]),
    { spaceId: 17, name: "Community Chest", type: "community_chest" },
    propertySpace(18, "Tennessee Avenue", 180, "orange", 100, [14, 70, 200, 550, 750, 950]),
    propertySpace(19, "New York Avenue", 200, "orange", 100, [16, 80, 220, 600, 800, 1000]),
    { spaceId: 20, name: "Free Parking", type: "free_parking" },
    propertySpace(21, "Kentucky Avenue", 220, "red", 150, [18, 90, 250, 700, 875, 1050]),
    { spaceId: 22, name: "Chance", type: "chance" },
    propertySpace(23, "Indiana Avenue", 220, "red", 150, [18, 90, 250, 700, 875, 1050]),
    propertySpace(24, "Illinois Avenue", 240, "red", 150, [20, 100, 300, 750, 925, 1100]),
    railroadSpace(25, "B&O Railroad"),
    propertySpace(26, "Atlantic Avenue", 260, "yellow", 150, [22, 110, 330, 800, 975, 1150]),
    propertySpace(27, "Ventnor Avenue", 260, "yellow", 150, [22, 110, 330, 800, 975, 1150]),
    utilitySpace(28, "Water Works"),
    propertySpace(29, "Marvin Gardens", 280, "yellow", 150, [24, 120, 360, 850, 1025, 1200]),
    { spaceId: 30, name: "Go To Jail", type: "go_to_jail" },
    propertySpace(31, "Pacific Avenue", 300, "green", 200, [26, 130, 390, 900, 1100, 1275]),
    propertySpace(
      32,
      "North Carolina Avenue",
      300,
      "green",
      200,
      [26, 130, 390, 900, 1100, 1275],
    ),
    { spaceId: 33, name: "Community Chest", type: "community_chest" },
    propertySpace(
      34,
      "Pennsylvania Avenue",
      320,
      "green",
      200,
      [28, 150, 450, 1000, 1200, 1400],
    ),
    railroadSpace(35, "Short Line Railroad"),
    { spaceId: 36, name: "Chance", type: "chance" },
    propertySpace(37, "Park Place", 350, "darkblue", 200, [35, 175, 500, 1100, 1300, 1500]),
    { spaceId: 38, name: "Luxury Tax", type: "tax", amount: 100 },
    propertySpace(39, "Boardwalk", 400, "darkblue", 200, [50, 200, 600, 1400, 1700, 2000]),
  ];
}

function cloneState(state: MonopolyGameState): MonopolyGameState {
  return {
    ...state,
    players: state.players.map((player) => ({ ...player })),
    board: state.board.map((space) => ({ ...space })),
    diceRoll: state.diceRoll ? ([...state.diceRoll] as [number, number]) : undefined,
    lastTurnEvents: state.lastTurnEvents.map((event) => ({ ...event })),
  };
}

function getBoardSpace(board: BoardSpace[], spaceId: number): BoardSpace {
  const space = board.find((candidate) => candidate.spaceId === spaceId);
  if (!space) throw new Error(`Monopoly space ${spaceId} is not defined`);
  return space;
}

function getDeck(deck: MonopolyDeckKind): MonopolyCard[] {
  return deck === "chance" ? CHANCE_DECK : COMMUNITY_CHEST_DECK;
}

function nextDeckCursor(state: MonopolyGameState, deck: MonopolyDeckKind): number {
  return deck === "chance" ? state.chanceCursor : state.communityChestCursor;
}

function setDeckCursor(state: MonopolyGameState, deck: MonopolyDeckKind, value: number): void {
  if (deck === "chance") {
    state.chanceCursor = value;
    return;
  }
  state.communityChestCursor = value;
}

function nextPlayerIndex(state: MonopolyGameState): number {
  const livePlayers = state.players
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => !player.isBankrupt)
    .map(({ index }) => index);
  if (livePlayers.length <= 1) return state.currentPlayerIndex;

  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const candidate = (state.currentPlayerIndex + offset) % state.players.length;
    if (!state.players[candidate].isBankrupt) {
      return candidate;
    }
  }

  return state.currentPlayerIndex;
}

function rollDice(): [number, number] {
  return [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
}

function pushEvent(events: MonopolyTurnEvent[], event: MonopolyTurnEvent): void {
  events.push(event);
}

function isDoubles([dieOne, dieTwo]: [number, number]): boolean {
  return dieOne === dieTwo;
}

function releasePlayerFromJail(player: MonopolyPlayer): void {
  player.inJail = false;
  player.jailTurns = 0;
}

function movePlayerBy(
  state: MonopolyGameState,
  playerIndex: number,
  steps: number,
  events: MonopolyTurnEvent[],
): void {
  const player = state.players[playerIndex];
  const from = player.position;
  const rawDestination = from + steps;
  const wrappedDestination = ((rawDestination % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;

  if (rawDestination >= BOARD_SIZE) {
    player.money += GO_MONEY;
    pushEvent(events, { type: "passed_go", amount: GO_MONEY });
  }

  player.position = wrappedDestination;
  pushEvent(events, {
    type: "moved",
    from,
    to: wrappedDestination,
    destinationName: getBoardSpace(state.board, wrappedDestination).name,
  });
}

function movePlayerTo(
  state: MonopolyGameState,
  playerIndex: number,
  destination: number,
  events: MonopolyTurnEvent[],
  reason: MonopolyDeckKind,
): void {
  const player = state.players[playerIndex];
  const from = player.position;

  if (destination < from) {
    player.money += GO_MONEY;
    pushEvent(events, { type: "passed_go", amount: GO_MONEY });
  }

  player.position = destination;
  releasePlayerFromJail(player);
  pushEvent(events, {
    type: "teleported",
    from,
    to: destination,
    destinationName: getBoardSpace(state.board, destination).name,
    reason,
  });
}

export function sendPlayerToJail(
  state: MonopolyGameState,
  playerIndex: number,
  events: MonopolyTurnEvent[],
): void {
  const player = state.players[playerIndex];
  const from = player.position;
  player.position = JAIL_SPACE_ID;
  player.inJail = true;
  player.jailTurns = 0;
  pushEvent(events, {
    type: "sent_to_jail",
    from,
    to: JAIL_SPACE_ID,
    destinationName: getBoardSpace(state.board, JAIL_SPACE_ID).name,
  });
}

function drawNextCard(
  state: MonopolyGameState,
  deck: MonopolyDeckKind,
  events: MonopolyTurnEvent[],
): MonopolyCard {
  const cards = getDeck(deck);
  const cursor = nextDeckCursor(state, deck);
  const card = cards[cursor % cards.length];
  setDeckCursor(state, deck, cursor + 1);
  pushEvent(events, {
    type: "drew_card",
    deck,
    cardId: card.id,
    cardText: card.text,
  });
  return card;
}

function findNearestSpace(
  board: BoardSpace[],
  startSpaceId: number,
  spaceType: "railroad" | "utility",
): number {
  for (let offset = 1; offset <= board.length; offset += 1) {
    const candidateSpaceId = (startSpaceId + offset) % board.length;
    const candidate = getBoardSpace(board, candidateSpaceId);
    if (candidate.type === spaceType) {
      return candidate.spaceId;
    }
  }
  return startSpaceId;
}

function resolveLandingSpace(
  state: MonopolyGameState,
  playerIndex: number,
  events: MonopolyTurnEvent[],
  depth = 0,
): void {
  if (depth > BOARD_SIZE) return;

  const player = state.players[playerIndex];
  const space = getBoardSpace(state.board, player.position);
  pushEvent(events, {
    type: "landed",
    spaceId: space.spaceId,
    spaceName: space.name,
    spaceType: space.type,
  });

  switch (space.type) {
    case "tax":
      player.money -= space.amount;
      pushEvent(events, {
        type: "paid_tax",
        amount: space.amount,
        spaceId: space.spaceId,
        spaceName: space.name,
      });
      return;
    case "go_to_jail":
      sendPlayerToJail(state, playerIndex, events);
      return;
    case "chance":
    case "community_chest": {
      const deck = space.type;
      const card = drawNextCard(state, deck, events);
      applyCardEffect(state, playerIndex, card.effect, deck, events, depth + 1);
      return;
    }
    default:
      return;
  }
}

export function applyCardEffect(
  state: MonopolyGameState,
  playerIndex: number,
  effect: MonopolyCardEffect,
  deck: MonopolyDeckKind,
  events: MonopolyTurnEvent[],
  depth = 0,
): void {
  switch (effect.type) {
    case "move_to_space":
      movePlayerTo(state, playerIndex, effect.spaceId, events, deck);
      resolveLandingSpace(state, playerIndex, events, depth);
      return;
    case "move_by":
      movePlayerBy(state, playerIndex, effect.spaces, events);
      resolveLandingSpace(state, playerIndex, events, depth);
      return;
    case "move_to_nearest": {
      const destination = findNearestSpace(
        state.board,
        state.players[playerIndex].position,
        effect.spaceType,
      );
      movePlayerTo(state, playerIndex, destination, events, deck);
      resolveLandingSpace(state, playerIndex, events, depth);
      return;
    }
    case "go_to_jail":
      sendPlayerToJail(state, playerIndex, events);
      return;
  }
}

export function resolveMonopolyTurn(
  state: MonopolyGameState,
  playerIndex: number,
  diceRoll: [number, number],
  moveType: MonopolyMove["type"] = "roll",
): MonopolyGameState | null {
  if (state.phase !== "playing") return null;
  if (playerIndex !== state.currentPlayerIndex) return null;
  if (state.players[playerIndex]?.isBankrupt) return null;

  const nextState = cloneState(state);
  nextState.diceRoll = diceRoll;
  nextState.lastTurnEvents = [];
  const player = nextState.players[playerIndex];

  if (player.inJail) {
    if (moveType === "pay_bail") {
      player.money -= BAIL_AMOUNT;
      pushEvent(nextState.lastTurnEvents, {
        type: "paid_bail",
        amount: BAIL_AMOUNT,
        automatic: false,
      });
      releasePlayerFromJail(player);
      pushEvent(nextState.lastTurnEvents, {
        type: "left_jail",
        method: "paid_bail",
      });
    }

    pushEvent(nextState.lastTurnEvents, { type: "rolled", dice: diceRoll });

    if (player.inJail) {
      if (isDoubles(diceRoll)) {
        releasePlayerFromJail(player);
        pushEvent(nextState.lastTurnEvents, {
          type: "left_jail",
          method: "rolled_doubles",
        });
      } else {
        player.jailTurns += 1;
        if (player.jailTurns >= MAX_JAIL_TURNS) {
          player.money -= BAIL_AMOUNT;
          pushEvent(nextState.lastTurnEvents, {
            type: "paid_bail",
            amount: BAIL_AMOUNT,
            automatic: true,
          });
          releasePlayerFromJail(player);
          pushEvent(nextState.lastTurnEvents, {
            type: "left_jail",
            method: "automatic_bail",
          });
        } else {
          pushEvent(nextState.lastTurnEvents, {
            type: "stayed_in_jail",
            turnsRemaining: MAX_JAIL_TURNS - player.jailTurns,
          });
          nextState.currentPlayerIndex = nextPlayerIndex(nextState);
          return nextState;
        }
      }
    }
  } else if (moveType === "pay_bail") {
    return null;
  } else {
    pushEvent(nextState.lastTurnEvents, { type: "rolled", dice: diceRoll });
  }

  movePlayerBy(nextState, playerIndex, diceRoll[0] + diceRoll[1], nextState.lastTurnEvents);
  resolveLandingSpace(nextState, playerIndex, nextState.lastTurnEvents);
  nextState.currentPlayerIndex = nextPlayerIndex(nextState);

  return nextState;
}

function deckLabel(deck: MonopolyDeckKind): string {
  return deck === "chance" ? "Chance" : "Community Chest";
}

function describeTurn(events: MonopolyTurnEvent[]): string {
  if (events.length === 0) return " rolled";

  const parts: string[] = [];
  for (const event of events) {
    switch (event.type) {
      case "rolled":
        parts.push(`rolled ${event.dice[0] + event.dice[1]}`);
        break;
      case "moved":
        parts.push(`moved to ${event.destinationName}`);
        break;
      case "landed":
        parts.push(`landed on ${event.spaceName}`);
        break;
      case "passed_go":
        parts.push(`collected $${event.amount} for passing Go`);
        break;
      case "paid_tax":
        parts.push(`paid $${event.amount} in tax`);
        break;
      case "drew_card":
        parts.push(`drew ${deckLabel(event.deck)} card "${event.cardText}"`);
        break;
      case "teleported":
        parts.push(`moved to ${event.destinationName}`);
        break;
      case "sent_to_jail":
        parts.push("went to Jail");
        break;
      case "stayed_in_jail":
        parts.push(`stayed in Jail (${event.turnsRemaining} turns remaining)`);
        break;
      case "paid_bail":
        parts.push(
          event.automatic
            ? `paid $${event.amount} bail after a third failed Jail roll`
            : `paid $${event.amount} bail`,
        );
        break;
      case "left_jail":
        switch (event.method) {
          case "rolled_doubles":
            parts.push("left Jail by rolling doubles");
            break;
          case "paid_bail":
            parts.push("left Jail");
            break;
          case "automatic_bail":
            parts.push("left Jail after paying automatic bail");
            break;
        }
        break;
    }
  }

  return ` ${parts.join(", ")}`;
}

export const monopolyLogic: GameLogic<MonopolyGameState, MonopolyGameState> = {
  minPlayers: 2,
  maxPlayers: 4,

  start: (numPlayers) => ({
    players: Array.from({ length: numPlayers }, () => ({
      money: STARTING_MONEY,
      position: 0,
      isBankrupt: false,
      inJail: false,
      jailTurns: 0,
    })),
    board: createInitialBoard(),
    currentPlayerIndex: 0,
    phase: "playing",
    diceRoll: undefined,
    winnerIndex: undefined,
    chanceCursor: 0,
    communityChestCursor: 0,
    lastTurnEvents: [],
  }),

  update: (state, payload, playerIndex) => {
    const move = zMonopolyMove.safeParse(payload);
    if (!move.success) return null;

    switch (move.data.type) {
      case "roll":
        return resolveMonopolyTurn(state, playerIndex, rollDice());
      case "pay_bail":
        return resolveMonopolyTurn(state, playerIndex, rollDice(), "pay_bail");
    }
  },

  isDone: (state) => state.phase === "finished",

  viewAs: (state) => state,

  tagView: (view) => ({ type: "monopoly", view }),

  describeMove: (_prevState, newState, move) => {
    const parsedMove = zMonopolyMove.safeParse(move);
    if (!parsedMove.success) return " made an invalid Monopoly move";
    return describeTurn(newState.lastTurnEvents);
  },
};

export const monopolyGameService = new GameService<MonopolyGameState, MonopolyGameState>(
  monopolyLogic,
);
