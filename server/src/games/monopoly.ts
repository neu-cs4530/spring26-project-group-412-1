import { GameService } from "./gameServiceManager.ts";
import {
  type BoardSpace,
  type MonopolyCard,
  type MonopolyCardEffect,
  type MonopolyDeckKind,
  type MonopolyGameState,
  type MonopolyTurnEvent,
  zMonopolyMove,
} from "@gamenite/shared";
import { type GameLogic } from "./gameLogic.ts";

const STARTING_MONEY = 1500;
const GO_MONEY = 200;
const BOARD_SIZE = 40;
const JAIL_SPACE_ID = 10;

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
    {
      spaceId: 1,
      name: "Mediterranean Avenue",
      type: "property",
      price: 60,
      rent: 2,
      colorGroup: "brown",
    },
    { spaceId: 2, name: "Community Chest", type: "community_chest" },
    {
      spaceId: 3,
      name: "Baltic Avenue",
      type: "property",
      price: 60,
      rent: 4,
      colorGroup: "brown",
    },
    { spaceId: 4, name: "Income Tax", type: "tax", amount: 200 },
    { spaceId: 5, name: "Reading Railroad", type: "railroad", price: 200, rent: 25 },
    {
      spaceId: 6,
      name: "Oriental Avenue",
      type: "property",
      price: 100,
      rent: 6,
      colorGroup: "lightblue",
    },
    { spaceId: 7, name: "Chance", type: "chance" },
    {
      spaceId: 8,
      name: "Vermont Avenue",
      type: "property",
      price: 100,
      rent: 6,
      colorGroup: "lightblue",
    },
    {
      spaceId: 9,
      name: "Connecticut Avenue",
      type: "property",
      price: 120,
      rent: 8,
      colorGroup: "lightblue",
    },
    { spaceId: 10, name: "Jail", type: "jail" },
    {
      spaceId: 11,
      name: "St. Charles Place",
      type: "property",
      price: 140,
      rent: 10,
      colorGroup: "pink",
    },
    { spaceId: 12, name: "Electric Company", type: "utility", price: 150, rent: 4 },
    {
      spaceId: 13,
      name: "States Avenue",
      type: "property",
      price: 140,
      rent: 10,
      colorGroup: "pink",
    },
    {
      spaceId: 14,
      name: "Virginia Avenue",
      type: "property",
      price: 160,
      rent: 12,
      colorGroup: "pink",
    },
    { spaceId: 15, name: "Pennsylvania Railroad", type: "railroad", price: 200, rent: 25 },
    {
      spaceId: 16,
      name: "St. James Place",
      type: "property",
      price: 180,
      rent: 14,
      colorGroup: "orange",
    },
    { spaceId: 17, name: "Community Chest", type: "community_chest" },
    {
      spaceId: 18,
      name: "Tennessee Avenue",
      type: "property",
      price: 180,
      rent: 14,
      colorGroup: "orange",
    },
    {
      spaceId: 19,
      name: "New York Avenue",
      type: "property",
      price: 200,
      rent: 16,
      colorGroup: "orange",
    },
    { spaceId: 20, name: "Free Parking", type: "free_parking" },
    {
      spaceId: 21,
      name: "Kentucky Avenue",
      type: "property",
      price: 220,
      rent: 18,
      colorGroup: "red",
    },
    { spaceId: 22, name: "Chance", type: "chance" },
    {
      spaceId: 23,
      name: "Indiana Avenue",
      type: "property",
      price: 220,
      rent: 18,
      colorGroup: "red",
    },
    {
      spaceId: 24,
      name: "Illinois Avenue",
      type: "property",
      price: 240,
      rent: 20,
      colorGroup: "red",
    },
    { spaceId: 25, name: "B&O Railroad", type: "railroad", price: 200, rent: 25 },
    {
      spaceId: 26,
      name: "Atlantic Avenue",
      type: "property",
      price: 260,
      rent: 22,
      colorGroup: "yellow",
    },
    {
      spaceId: 27,
      name: "Ventnor Avenue",
      type: "property",
      price: 260,
      rent: 22,
      colorGroup: "yellow",
    },
    { spaceId: 28, name: "Water Works", type: "utility", price: 150, rent: 4 },
    {
      spaceId: 29,
      name: "Marvin Gardens",
      type: "property",
      price: 280,
      rent: 24,
      colorGroup: "yellow",
    },
    { spaceId: 30, name: "Go To Jail", type: "go_to_jail" },
    {
      spaceId: 31,
      name: "Pacific Avenue",
      type: "property",
      price: 300,
      rent: 26,
      colorGroup: "green",
    },
    {
      spaceId: 32,
      name: "North Carolina Avenue",
      type: "property",
      price: 300,
      rent: 26,
      colorGroup: "green",
    },
    { spaceId: 33, name: "Community Chest", type: "community_chest" },
    {
      spaceId: 34,
      name: "Pennsylvania Avenue",
      type: "property",
      price: 320,
      rent: 28,
      colorGroup: "green",
    },
    { spaceId: 35, name: "Short Line Railroad", type: "railroad", price: 200, rent: 25 },
    { spaceId: 36, name: "Chance", type: "chance" },
    {
      spaceId: 37,
      name: "Park Place",
      type: "property",
      price: 350,
      rent: 35,
      colorGroup: "darkblue",
    },
    { spaceId: 38, name: "Luxury Tax", type: "tax", amount: 100 },
    {
      spaceId: 39,
      name: "Boardwalk",
      type: "property",
      price: 400,
      rent: 50,
      colorGroup: "darkblue",
    },
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
  player.inJail = false;
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
): MonopolyGameState | null {
  if (state.phase !== "playing") return null;
  if (playerIndex !== state.currentPlayerIndex) return null;
  if (state.players[playerIndex]?.isBankrupt) return null;

  const nextState = cloneState(state);
  nextState.diceRoll = diceRoll;
  nextState.lastTurnEvents = [];

  if (nextState.players[playerIndex].inJail) {
    nextState.players[playerIndex].inJail = false;
  }

  pushEvent(nextState.lastTurnEvents, { type: "rolled", dice: diceRoll });
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
