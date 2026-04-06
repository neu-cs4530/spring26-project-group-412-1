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
  type OwnableSpace,
  zMonopolyMove,
} from "@gamenite/shared";
import { type GameLogic } from "./gameLogic.ts";

const STARTING_MONEY = 1500;
const GO_MONEY = 200;
const BOARD_SIZE = 40;
const JAIL_SPACE_ID = 10;
const BAIL_AMOUNT = 50;
const MAX_JAIL_TURNS = 3;
const MAX_CONSECUTIVE_DOUBLES = 3;

interface LandingContext {
  rentMultiplier?: number;
  utilityMultiplierOverride?: number;
}

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
    mortgaged: false,
    houseCost,
    mortgageValue: price / 2,
    rentSchedule,
    houseCount: 0,
    hotelCount: 0,
  };
}

function railroadSpace(spaceId: number, name: string): BoardSpace {
  return {
    spaceId,
    name,
    type: "railroad",
    price: 200,
    rent: 25,
    mortgaged: false,
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
    mortgaged: false,
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
    effect: { type: "move_to_nearest", spaceType: "railroad", rentMultiplier: 2 },
  },
  {
    id: "chance-nearest-railroad-2",
    deck: "chance",
    text: "Advance token to nearest Railroad",
    effect: { type: "move_to_nearest", spaceType: "railroad", rentMultiplier: 2 },
  },
  {
    id: "chance-nearest-utility",
    deck: "chance",
    text: "Advance token to nearest Utility",
    effect: { type: "move_to_nearest", spaceType: "utility", utilityMultiplierOverride: 10 },
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
  {
    id: "chance-bank-dividend",
    deck: "chance",
    text: "Bank pays you dividend of $50",
    effect: { type: "receive_money", amount: 50, source: "Chance dividend" },
  },
  {
    id: "chance-get-out-of-jail",
    deck: "chance",
    text: "Get Out of Jail Free",
    effect: { type: "get_out_of_jail_free" },
  },
  {
    id: "chance-poor-tax",
    deck: "chance",
    text: "Pay poor tax of $15",
    effect: { type: "pay_money", amount: 15, source: "Chance poor tax" },
  },
  {
    id: "chance-building-loan",
    deck: "chance",
    text: "Your building loan matures. Collect $150",
    effect: { type: "receive_money", amount: 150, source: "Chance building loan" },
  },
  {
    id: "chance-chairman",
    deck: "chance",
    text: "You have been elected Chairman of the Board. Pay each player $50",
    effect: { type: "pay_each_player", amount: 50, source: "Chance chairman fee" },
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
    id: "community-bank-error",
    deck: "community_chest",
    text: "Bank error in your favor. Collect $200",
    effect: { type: "receive_money", amount: 200, source: "Community Chest bank error" },
  },
  {
    id: "community-doctor-fee",
    deck: "community_chest",
    text: "Doctor's fees. Pay $50",
    effect: { type: "pay_money", amount: 50, source: "Community Chest doctor's fee" },
  },
  {
    id: "community-sale-stock",
    deck: "community_chest",
    text: "From sale of stock you get $50",
    effect: { type: "receive_money", amount: 50, source: "Community Chest stock sale" },
  },
  {
    id: "community-get-out-of-jail",
    deck: "community_chest",
    text: "Get Out of Jail Free",
    effect: { type: "get_out_of_jail_free" },
  },
  {
    id: "community-go-to-jail",
    deck: "community_chest",
    text: "Go to Jail",
    effect: { type: "go_to_jail" },
  },
  {
    id: "community-holiday-fund",
    deck: "community_chest",
    text: "Holiday fund matures. Receive $100",
    effect: { type: "receive_money", amount: 100, source: "Community Chest holiday fund" },
  },
  {
    id: "community-tax-refund",
    deck: "community_chest",
    text: "Income tax refund. Collect $20",
    effect: { type: "receive_money", amount: 20, source: "Community Chest tax refund" },
  },
  {
    id: "community-birthday",
    deck: "community_chest",
    text: "It is your birthday. Collect $10 from each player",
    effect: { type: "collect_from_each_player", amount: 10, source: "Community Chest birthday" },
  },
  {
    id: "community-life-insurance",
    deck: "community_chest",
    text: "Life insurance matures. Collect $100",
    effect: { type: "receive_money", amount: 100, source: "Community Chest life insurance" },
  },
  {
    id: "community-hospital-fees",
    deck: "community_chest",
    text: "Pay hospital fees of $100",
    effect: { type: "pay_money", amount: 100, source: "Community Chest hospital fees" },
  },
  {
    id: "community-school-fees",
    deck: "community_chest",
    text: "Pay school fees of $50",
    effect: { type: "pay_money", amount: 50, source: "Community Chest school fees" },
  },
  {
    id: "community-consultancy",
    deck: "community_chest",
    text: "Receive $25 consultancy fee",
    effect: { type: "receive_money", amount: 25, source: "Community Chest consultancy fee" },
  },
  {
    id: "community-beauty-contest",
    deck: "community_chest",
    text: "You have won second prize in a beauty contest. Collect $10",
    effect: { type: "receive_money", amount: 10, source: "Community Chest contest prize" },
  },
  {
    id: "community-inherit",
    deck: "community_chest",
    text: "You inherit $100",
    effect: { type: "receive_money", amount: 100, source: "Community Chest inheritance" },
  },
];

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

function isOwnableSpace(space: BoardSpace): space is OwnableSpace {
  return space.type === "property" || space.type === "railroad" || space.type === "utility";
}

function getOwnableSpace(board: BoardSpace[], spaceId: number): OwnableSpace {
  const space = getBoardSpace(board, spaceId);
  if (!isOwnableSpace(space)) {
    throw new Error(`Monopoly space ${spaceId} is not ownable`);
  }
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

function livingPlayerIndices(state: MonopolyGameState): number[] {
  return state.players
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => !player.isBankrupt)
    .map(({ index }) => index);
}

function nextPlayerIndex(state: MonopolyGameState): number {
  const livePlayers = livingPlayerIndices(state);
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

function totalJailCards(player: MonopolyPlayer): number {
  return player.chanceGetOutOfJailFreeCards + player.communityChestGetOutOfJailFreeCards;
}

function releasePlayerFromJail(player: MonopolyPlayer): void {
  player.inJail = false;
  player.jailTurns = 0;
}

function advanceTurn(state: MonopolyGameState): void {
  state.currentPlayerIndex = nextPlayerIndex(state);
  state.turnPhase = "awaiting_roll";
  state.pendingPropertyId = undefined;
  state.extraTurn = false;
  state.consecutiveDoubles = 0;
}

function checkForWinner(state: MonopolyGameState, events: MonopolyTurnEvent[]): void {
  const livePlayers = livingPlayerIndices(state);
  if (livePlayers.length === 1) {
    state.phase = "finished";
    state.winnerIndex = livePlayers[0];
    state.turnPhase = "awaiting_end_turn";
    pushEvent(events, { type: "won_game", winnerIndex: livePlayers[0] });
  }
}

function transferOwnedSpaces(
  state: MonopolyGameState,
  fromPlayerIndex: number,
  creditorIndex?: number,
): void {
  state.board = state.board.map((space) => {
    if (!isOwnableSpace(space) || space.ownerIndex !== fromPlayerIndex) {
      return space;
    }
    return {
      ...space,
      ownerIndex: creditorIndex,
      rent: space.type === "property" ? (space.rentSchedule?.[0] ?? space.rent) : space.rent,
      houseCount: space.type === "property" ? 0 : undefined,
      hotelCount: space.type === "property" ? 0 : undefined,
    };
  });
}

function makeBankrupt(
  state: MonopolyGameState,
  playerIndex: number,
  creditorIndex: number | undefined,
  reason: string,
  events: MonopolyTurnEvent[],
): void {
  const player = state.players[playerIndex];
  if (player.isBankrupt) return;

  if (creditorIndex !== undefined && creditorIndex !== playerIndex) {
    state.players[creditorIndex].money += Math.max(player.money, 0);
  }
  player.money = 0;
  player.isBankrupt = true;
  player.inJail = false;
  player.jailTurns = 0;

  if (player.chanceGetOutOfJailFreeCards > 0) {
    state.chanceGetOutOfJailFreeAvailable = true;
    player.chanceGetOutOfJailFreeCards = 0;
  }
  if (player.communityChestGetOutOfJailFreeCards > 0) {
    state.communityChestGetOutOfJailFreeAvailable = true;
    player.communityChestGetOutOfJailFreeCards = 0;
  }

  transferOwnedSpaces(state, playerIndex, creditorIndex);
  pushEvent(events, { type: "bankruptcy", playerIndex, creditorIndex, reason });
  checkForWinner(state, events);
}

function creditPlayer(
  state: MonopolyGameState,
  playerIndex: number,
  amount: number,
  source: string,
  events: MonopolyTurnEvent[],
): void {
  if (amount <= 0) return;
  state.players[playerIndex].money += amount;
  pushEvent(events, { type: "received_money", amount, source });
}

function chargeBank(
  state: MonopolyGameState,
  playerIndex: number,
  amount: number,
  source: string,
  events: MonopolyTurnEvent[],
): void {
  if (amount <= 0) return;
  const player = state.players[playerIndex];
  if (player.money >= amount) {
    player.money -= amount;
    pushEvent(events, { type: "paid_money", amount, source });
    return;
  }

  pushEvent(events, { type: "paid_money", amount: Math.max(player.money, 0), source });
  makeBankrupt(state, playerIndex, undefined, source, events);
}

function transferMoney(
  state: MonopolyGameState,
  fromPlayerIndex: number,
  toPlayerIndex: number,
  amount: number,
  reason: string,
  events: MonopolyTurnEvent[],
  rentSpace?: { spaceId: number; spaceName: string },
): void {
  if (amount <= 0) return;
  const fromPlayer = state.players[fromPlayerIndex];
  const toPlayer = state.players[toPlayerIndex];

  if (fromPlayer.money >= amount) {
    fromPlayer.money -= amount;
    toPlayer.money += amount;
    if (rentSpace) {
      pushEvent(events, {
        type: "paid_rent",
        amount,
        spaceId: rentSpace.spaceId,
        spaceName: rentSpace.spaceName,
        ownerIndex: toPlayerIndex,
      });
    } else {
      pushEvent(events, { type: "paid_money", amount, source: reason });
      pushEvent(events, { type: "received_money", amount, source: reason });
    }
    return;
  }

  const amountPaid = Math.max(fromPlayer.money, 0);
  toPlayer.money += amountPaid;
  if (rentSpace && amountPaid > 0) {
    pushEvent(events, {
      type: "paid_rent",
      amount: amountPaid,
      spaceId: rentSpace.spaceId,
      spaceName: rentSpace.spaceName,
      ownerIndex: toPlayerIndex,
    });
  } else if (amountPaid > 0) {
    pushEvent(events, { type: "paid_money", amount: amountPaid, source: reason });
    pushEvent(events, { type: "received_money", amount: amountPaid, source: reason });
  }

  fromPlayer.money = 0;
  makeBankrupt(state, fromPlayerIndex, toPlayerIndex, reason, events);
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
  state.pendingPropertyId = undefined;
  state.extraTurn = false;
  state.consecutiveDoubles = 0;
  pushEvent(events, {
    type: "sent_to_jail",
    from,
    to: JAIL_SPACE_ID,
    destinationName: getBoardSpace(state.board, JAIL_SPACE_ID).name,
  });
}

function isJailCardAvailable(state: MonopolyGameState, deck: MonopolyDeckKind): boolean {
  return deck === "chance"
    ? state.chanceGetOutOfJailFreeAvailable
    : state.communityChestGetOutOfJailFreeAvailable;
}

function setJailCardAvailability(
  state: MonopolyGameState,
  deck: MonopolyDeckKind,
  isAvailable: boolean,
): void {
  if (deck === "chance") {
    state.chanceGetOutOfJailFreeAvailable = isAvailable;
    return;
  }
  state.communityChestGetOutOfJailFreeAvailable = isAvailable;
}

function drawNextCard(
  state: MonopolyGameState,
  deck: MonopolyDeckKind,
  events: MonopolyTurnEvent[],
): MonopolyCard {
  const cards = getDeck(deck);
  let cursor = nextDeckCursor(state, deck);

  for (let offset = 0; offset < cards.length; offset += 1) {
    const card = cards[(cursor + offset) % cards.length];
    if (card.effect.type === "get_out_of_jail_free" && !isJailCardAvailable(state, deck)) {
      continue;
    }
    cursor = cursor + offset;
    setDeckCursor(state, deck, cursor + 1);
    pushEvent(events, {
      type: "drew_card",
      deck,
      cardId: card.id,
      cardText: card.text,
    });
    return card;
  }

  throw new Error(`No drawable cards left in ${deck}`);
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

function countOwnedSpaces(
  state: MonopolyGameState,
  ownerIndex: number,
  type: OwnableSpace["type"],
): number {
  return state.board.filter(
    (space) => isOwnableSpace(space) && space.ownerIndex === ownerIndex && space.type === type,
  ).length;
}

function mortgageValue(space: OwnableSpace): number {
  return space.mortgageValue ?? Math.floor(space.price / 2);
}

function unmortgageCost(space: OwnableSpace): number {
  return Math.ceil((mortgageValue(space) * 11) / 10);
}

function hasBuildings(space: OwnableSpace): boolean {
  return space.type === "property" && ((space.houseCount ?? 0) > 0 || (space.hotelCount ?? 0) > 0);
}

function propertiesInColorGroup(state: MonopolyGameState, colorGroup: string) {
  return state.board.filter(
    (space): space is Extract<OwnableSpace, { type: "property" }> =>
      space.type === "property" && space.colorGroup === colorGroup,
  );
}

function ownsFullColorGroup(
  state: MonopolyGameState,
  playerIndex: number,
  colorGroup: string,
): boolean {
  const group = propertiesInColorGroup(state, colorGroup);
  return group.length > 0 && group.every((space) => space.ownerIndex === playerIndex);
}

function colorGroupHasMortgagedProperty(state: MonopolyGameState, colorGroup: string): boolean {
  return propertiesInColorGroup(state, colorGroup).some((space) => space.mortgaged);
}

function colorGroupHasBuildings(state: MonopolyGameState, colorGroup: string): boolean {
  return propertiesInColorGroup(state, colorGroup).some((space) => hasBuildings(space));
}

function canBuildHouse(
  state: MonopolyGameState,
  playerIndex: number,
  property: Extract<OwnableSpace, { type: "property" }>,
): boolean {
  if (property.ownerIndex !== playerIndex) return false;
  if (property.mortgaged) return false;
  if (!ownsFullColorGroup(state, playerIndex, property.colorGroup)) return false;
  if (colorGroupHasMortgagedProperty(state, property.colorGroup)) return false;
  if ((property.hotelCount ?? 0) > 0) return false;
  const group = propertiesInColorGroup(state, property.colorGroup);
  const minimumHouses = Math.min(...group.map((space) => space.houseCount ?? 0));
  return (property.houseCount ?? 0) < 4 && (property.houseCount ?? 0) === minimumHouses;
}

function canBuildHotel(
  state: MonopolyGameState,
  playerIndex: number,
  property: Extract<OwnableSpace, { type: "property" }>,
): boolean {
  if (property.ownerIndex !== playerIndex) return false;
  if (property.mortgaged) return false;
  if (!ownsFullColorGroup(state, playerIndex, property.colorGroup)) return false;
  if (colorGroupHasMortgagedProperty(state, property.colorGroup)) return false;
  if ((property.hotelCount ?? 0) > 0 || (property.houseCount ?? 0) !== 4) return false;
  return propertiesInColorGroup(state, property.colorGroup).every(
    space => (space.spaceId === property.spaceId ? true : (space.hotelCount ?? 0) > 0 || (space.houseCount ?? 0) === 4),
  );
}

function canMortgageSpace(
  state: MonopolyGameState,
  playerIndex: number,
  space: OwnableSpace,
): boolean {
  if (space.ownerIndex !== playerIndex) return false;
  if (space.mortgaged) return false;
  if (space.type === "property" && colorGroupHasBuildings(state, space.colorGroup)) return false;
  return true;
}

function calculateRent(
  state: MonopolyGameState,
  space: OwnableSpace,
  diceTotal: number,
  context: LandingContext,
): number {
  if (space.mortgaged) return 0;

  switch (space.type) {
    case "property":
      if ((space.hotelCount ?? 0) > 0) {
        return space.rentSchedule?.[5] ?? space.rent;
      }
      if ((space.houseCount ?? 0) > 0) {
        return space.rentSchedule?.[space.houseCount ?? 0] ?? space.rent;
      }
      if (ownsFullColorGroup(state, space.ownerIndex!, space.colorGroup)) {
        return space.rent * 2;
      }
      return space.rent;
    case "railroad": {
      const ownedRailroads = countOwnedSpaces(state, space.ownerIndex!, "railroad");
      const baseRent = space.railroadRentSchedule?.[Math.max(ownedRailroads - 1, 0)] ?? space.rent;
      return baseRent * (context.rentMultiplier ?? 1);
    }
    case "utility": {
      const multiplier =
        context.utilityMultiplierOverride ??
        space.utilityMultiplierSchedule?.[
          countOwnedSpaces(state, space.ownerIndex!, "utility") >= 2 ? 1 : 0
        ] ??
        space.rent;
      return multiplier * diceTotal;
    }
  }
}

function resolveLandingSpace(
  state: MonopolyGameState,
  playerIndex: number,
  events: MonopolyTurnEvent[],
  landingContext: LandingContext = {},
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

  if (isOwnableSpace(space)) {
    if (space.ownerIndex === undefined) {
      if (player.money >= space.price) {
        state.pendingPropertyId = space.spaceId;
        state.turnPhase = "awaiting_purchase";
        pushEvent(events, {
          type: "property_available",
          spaceId: space.spaceId,
          spaceName: space.name,
          price: space.price,
        });
      }
      return;
    }

    if (space.ownerIndex !== playerIndex) {
      const diceTotal = state.diceRoll ? state.diceRoll[0] + state.diceRoll[1] : 0;
      const rent = calculateRent(state, space, diceTotal, landingContext);
      transferMoney(state, playerIndex, space.ownerIndex, rent, `${space.name} rent`, events, {
        spaceId: space.spaceId,
        spaceName: space.name,
      });
    }
    return;
  }

  switch (space.type) {
    case "tax":
      player.money -= space.amount;
      pushEvent(events, {
        type: "paid_tax",
        amount: space.amount,
        spaceId: space.spaceId,
        spaceName: space.name,
      });
      if (player.money < 0) {
        makeBankrupt(state, playerIndex, undefined, `${space.name} tax`, events);
      }
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
      resolveLandingSpace(state, playerIndex, events, {}, depth);
      return;
    case "move_by":
      movePlayerBy(state, playerIndex, effect.spaces, events);
      resolveLandingSpace(state, playerIndex, events, {}, depth);
      return;
    case "move_to_nearest": {
      const destination = findNearestSpace(
        state.board,
        state.players[playerIndex].position,
        effect.spaceType,
      );
      movePlayerTo(state, playerIndex, destination, events, deck);
      resolveLandingSpace(
        state,
        playerIndex,
        events,
        {
          rentMultiplier: effect.rentMultiplier,
          utilityMultiplierOverride: effect.utilityMultiplierOverride,
        },
        depth,
      );
      return;
    }
    case "go_to_jail":
      sendPlayerToJail(state, playerIndex, events);
      return;
    case "receive_money":
      creditPlayer(state, playerIndex, effect.amount, effect.source, events);
      return;
    case "pay_money":
      chargeBank(state, playerIndex, effect.amount, effect.source, events);
      return;
    case "collect_from_each_player":
      for (let index = 0; index < state.players.length; index += 1) {
        if (index === playerIndex || state.players[index].isBankrupt || state.phase === "finished") {
          continue;
        }
        transferMoney(state, index, playerIndex, effect.amount, effect.source, events);
      }
      return;
    case "pay_each_player":
      for (let index = 0; index < state.players.length; index += 1) {
        if (index === playerIndex || state.players[index].isBankrupt || state.phase === "finished") {
          continue;
        }
        transferMoney(state, playerIndex, index, effect.amount, effect.source, events);
        if (state.players[playerIndex].isBankrupt || state.winnerIndex !== undefined) {
          return;
        }
      }
      return;
    case "get_out_of_jail_free":
      if (deck === "chance") {
        state.players[playerIndex].chanceGetOutOfJailFreeCards += 1;
      } else {
        state.players[playerIndex].communityChestGetOutOfJailFreeCards += 1;
      }
      setJailCardAvailability(state, deck, false);
      pushEvent(events, { type: "received_get_out_of_jail_card", deck });
      return;
  }
}

function finishTurnAfterResolution(
  state: MonopolyGameState,
  playerIndex: number,
  startedTurnInJail: boolean,
  rolledDoubles: boolean,
): MonopolyGameState {
  if (state.phase === "finished") return state;

  const player = state.players[playerIndex];
  if (player.isBankrupt) {
    advanceTurn(state);
    return state;
  }

  if (player.inJail) {
    advanceTurn(state);
    return state;
  }

  state.extraTurn = rolledDoubles && !startedTurnInJail;
  if (state.turnPhase === "awaiting_purchase") {
    return state;
  }

  if (state.extraTurn) {
    state.turnPhase = "awaiting_roll";
    return state;
  }

  state.turnPhase = "awaiting_end_turn";
  return state;
}

function consumeGetOutOfJailCard(
  state: MonopolyGameState,
  playerIndex: number,
): MonopolyDeckKind | null {
  const player = state.players[playerIndex];
  if (player.chanceGetOutOfJailFreeCards > 0) {
    player.chanceGetOutOfJailFreeCards -= 1;
    state.chanceGetOutOfJailFreeAvailable = true;
    return "chance";
  }
  if (player.communityChestGetOutOfJailFreeCards > 0) {
    player.communityChestGetOutOfJailFreeCards -= 1;
    state.communityChestGetOutOfJailFreeAvailable = true;
    return "community_chest";
  }
  return null;
}

export function resolveMonopolyTurn(
  state: MonopolyGameState,
  playerIndex: number,
  diceRoll: [number, number],
  moveType: "roll" | "pay_bail" | "use_get_out_of_jail_card" = "roll",
): MonopolyGameState | null {
  if (state.phase !== "playing") return null;
  if (state.turnPhase !== "awaiting_roll") return null;
  if (playerIndex !== state.currentPlayerIndex) return null;
  if (state.players[playerIndex]?.isBankrupt) return null;

  const nextState = cloneState(state);
  nextState.diceRoll = diceRoll;
  nextState.lastTurnEvents = [];
  nextState.pendingPropertyId = undefined;
  const player = nextState.players[playerIndex];
  const startedTurnInJail = player.inJail;
  const rolledDoubles = isDoubles(diceRoll);

  if (player.inJail) {
    if (moveType === "pay_bail") {
      if (player.money < BAIL_AMOUNT) {
        chargeBank(nextState, playerIndex, BAIL_AMOUNT, "Jail bail", nextState.lastTurnEvents);
        if (player.isBankrupt || nextState.phase === "finished") {
          advanceTurn(nextState);
          return nextState;
        }
      } else {
        player.money -= BAIL_AMOUNT;
        pushEvent(nextState.lastTurnEvents, {
          type: "paid_bail",
          amount: BAIL_AMOUNT,
          automatic: false,
        });
      }
      releasePlayerFromJail(player);
      pushEvent(nextState.lastTurnEvents, {
        type: "left_jail",
        method: "paid_bail",
      });
    } else if (moveType === "use_get_out_of_jail_card") {
      const deck = consumeGetOutOfJailCard(nextState, playerIndex);
      if (!deck) return null;
      pushEvent(nextState.lastTurnEvents, { type: "used_get_out_of_jail_card", deck });
      releasePlayerFromJail(player);
      pushEvent(nextState.lastTurnEvents, {
        type: "left_jail",
        method: "paid_bail",
      });
    }

    pushEvent(nextState.lastTurnEvents, { type: "rolled", dice: diceRoll });

    if (player.inJail) {
      if (rolledDoubles) {
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
          if (player.money < 0) {
            makeBankrupt(
              nextState,
              playerIndex,
              undefined,
              "Automatic jail bail",
              nextState.lastTurnEvents,
            );
            if (nextState.phase !== "finished") {
              advanceTurn(nextState);
            }
            return nextState;
          }
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
          advanceTurn(nextState);
          return nextState;
        }
      }
    }
  } else {
    if (moveType !== "roll") return null;
    pushEvent(nextState.lastTurnEvents, { type: "rolled", dice: diceRoll });
    if (rolledDoubles) {
      nextState.consecutiveDoubles += 1;
      if (nextState.consecutiveDoubles >= MAX_CONSECUTIVE_DOUBLES) {
        sendPlayerToJail(nextState, playerIndex, nextState.lastTurnEvents);
        advanceTurn(nextState);
        return nextState;
      }
    } else {
      nextState.consecutiveDoubles = 0;
    }
  }

  movePlayerBy(nextState, playerIndex, diceRoll[0] + diceRoll[1], nextState.lastTurnEvents);
  resolveLandingSpace(nextState, playerIndex, nextState.lastTurnEvents);
  return finishTurnAfterResolution(nextState, playerIndex, startedTurnInJail, rolledDoubles);
}

function resolvePropertyDecision(
  state: MonopolyGameState,
  playerIndex: number,
  decision: "buy_property" | "pass_property",
): MonopolyGameState | null {
  if (state.phase !== "playing") return null;
  if (state.turnPhase !== "awaiting_purchase") return null;
  if (playerIndex !== state.currentPlayerIndex) return null;
  if (state.pendingPropertyId === undefined) return null;

  const nextState = cloneState(state);
  nextState.lastTurnEvents = [];
  const property = getOwnableSpace(nextState.board, nextState.pendingPropertyId!);
  const player = nextState.players[playerIndex];

  if (property.ownerIndex !== undefined) return null;

  if (decision === "buy_property") {
    if (player.money < property.price) return null;
    player.money -= property.price;
    property.ownerIndex = playerIndex;
    pushEvent(nextState.lastTurnEvents, {
      type: "property_purchased",
      spaceId: property.spaceId,
      spaceName: property.name,
      price: property.price,
    });
  } else {
    pushEvent(nextState.lastTurnEvents, {
      type: "property_purchase_skipped",
      spaceId: property.spaceId,
      spaceName: property.name,
    });
  }

  nextState.pendingPropertyId = undefined;
  nextState.turnPhase = nextState.extraTurn ? "awaiting_roll" : "awaiting_end_turn";
  return nextState;
}

function resolveEndTurn(state: MonopolyGameState, playerIndex: number): MonopolyGameState | null {
  if (state.phase !== "playing") return null;
  if (state.turnPhase !== "awaiting_end_turn") return null;
  if (playerIndex !== state.currentPlayerIndex) return null;

  const nextState = cloneState(state);
  nextState.lastTurnEvents = [];
  advanceTurn(nextState);
  return nextState;
}

function canManageProperties(state: MonopolyGameState, playerIndex: number): boolean {
  return (
    state.phase === "playing" &&
    state.turnPhase !== "awaiting_purchase" &&
    playerIndex === state.currentPlayerIndex &&
    !state.players[playerIndex]?.isBankrupt
  );
}

function resolveBuildHouse(
  state: MonopolyGameState,
  playerIndex: number,
  spaceId: number,
): MonopolyGameState | null {
  if (!canManageProperties(state, playerIndex)) return null;

  const nextState = cloneState(state);
  nextState.lastTurnEvents = [];
  const property = getOwnableSpace(nextState.board, spaceId);
  if (property.type !== "property") return null;
  if (!canBuildHouse(nextState, playerIndex, property)) return null;
  if (nextState.players[playerIndex].money < (property.houseCost ?? 0)) return null;

  nextState.players[playerIndex].money -= property.houseCost ?? 0;
  property.houseCount = (property.houseCount ?? 0) + 1;
  property.hotelCount = 0;
  property.rent = property.rentSchedule?.[property.houseCount] ?? property.rent;
  pushEvent(nextState.lastTurnEvents, {
    type: "built_house",
    spaceId: property.spaceId,
    spaceName: property.name,
    houseCount: property.houseCount,
    amount: property.houseCost ?? 0,
  });
  return nextState;
}

function resolveBuildHotel(
  state: MonopolyGameState,
  playerIndex: number,
  spaceId: number,
): MonopolyGameState | null {
  if (!canManageProperties(state, playerIndex)) return null;

  const nextState = cloneState(state);
  nextState.lastTurnEvents = [];
  const property = getOwnableSpace(nextState.board, spaceId);
  if (property.type !== "property") return null;
  if (!canBuildHotel(nextState, playerIndex, property)) return null;
  if (nextState.players[playerIndex].money < (property.houseCost ?? 0)) return null;

  nextState.players[playerIndex].money -= property.houseCost ?? 0;
  property.houseCount = 0;
  property.hotelCount = 1;
  property.rent = property.rentSchedule?.[5] ?? property.rent;
  pushEvent(nextState.lastTurnEvents, {
    type: "built_hotel",
    spaceId: property.spaceId,
    spaceName: property.name,
    amount: property.houseCost ?? 0,
  });
  return nextState;
}

function resolveMortgageProperty(
  state: MonopolyGameState,
  playerIndex: number,
  spaceId: number,
): MonopolyGameState | null {
  if (!canManageProperties(state, playerIndex)) return null;

  const nextState = cloneState(state);
  nextState.lastTurnEvents = [];
  const space = getOwnableSpace(nextState.board, spaceId);
  if (!canMortgageSpace(nextState, playerIndex, space)) return null;

  const amount = mortgageValue(space);
  space.mortgaged = true;
  nextState.players[playerIndex].money += amount;
  pushEvent(nextState.lastTurnEvents, {
    type: "mortgaged_property",
    spaceId: space.spaceId,
    spaceName: space.name,
    amount,
  });
  return nextState;
}

function resolveUnmortgageProperty(
  state: MonopolyGameState,
  playerIndex: number,
  spaceId: number,
): MonopolyGameState | null {
  if (!canManageProperties(state, playerIndex)) return null;

  const nextState = cloneState(state);
  nextState.lastTurnEvents = [];
  const space = getOwnableSpace(nextState.board, spaceId);
  if (space.ownerIndex !== playerIndex || !space.mortgaged) return null;

  const amount = unmortgageCost(space);
  if (nextState.players[playerIndex].money < amount) return null;

  nextState.players[playerIndex].money -= amount;
  space.mortgaged = false;
  pushEvent(nextState.lastTurnEvents, {
    type: "unmortgaged_property",
    spaceId: space.spaceId,
    spaceName: space.name,
    amount,
  });
  return nextState;
}

function deckLabel(deck: MonopolyDeckKind): string {
  return deck === "chance" ? "Chance" : "Community Chest";
}

function describeTurn(events: MonopolyTurnEvent[]): string {
  if (events.length === 0) return " waited";

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
      case "paid_money":
        parts.push(`paid $${event.amount} for ${event.source}`);
        break;
      case "received_money":
        parts.push(`received $${event.amount} from ${event.source}`);
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
      case "received_get_out_of_jail_card":
        parts.push(`received a ${deckLabel(event.deck)} Get Out of Jail Free card`);
        break;
      case "used_get_out_of_jail_card":
        parts.push(`used a ${deckLabel(event.deck)} Get Out of Jail Free card`);
        break;
      case "property_available":
        parts.push(`can buy ${event.spaceName} for $${event.price}`);
        break;
      case "property_purchased":
        parts.push(`bought ${event.spaceName} for $${event.price}`);
        break;
      case "property_purchase_skipped":
        parts.push(`passed on buying ${event.spaceName}`);
        break;
      case "paid_rent":
        parts.push(`paid $${event.amount} rent on ${event.spaceName}`);
        break;
      case "built_house":
        parts.push(`built house #${event.houseCount} on ${event.spaceName} for $${event.amount}`);
        break;
      case "built_hotel":
        parts.push(`built a hotel on ${event.spaceName} for $${event.amount}`);
        break;
      case "mortgaged_property":
        parts.push(`mortgaged ${event.spaceName} for $${event.amount}`);
        break;
      case "unmortgaged_property":
        parts.push(`unmortgaged ${event.spaceName} for $${event.amount}`);
        break;
      case "bankruptcy":
        parts.push(`went bankrupt from ${event.reason}`);
        break;
      case "won_game":
        parts.push("won the game");
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
      chanceGetOutOfJailFreeCards: 0,
      communityChestGetOutOfJailFreeCards: 0,
    })),
    board: createInitialBoard(),
    currentPlayerIndex: 0,
    phase: "playing",
    turnPhase: "awaiting_roll",
    pendingPropertyId: undefined,
    extraTurn: false,
    consecutiveDoubles: 0,
    winnerIndex: undefined,
    diceRoll: undefined,
    chanceCursor: 0,
    communityChestCursor: 0,
    chanceGetOutOfJailFreeAvailable: true,
    communityChestGetOutOfJailFreeAvailable: true,
    lastTurnEvents: [],
  }),
  update: (state, payload, playerIndex) => {
    const move = zMonopolyMove.safeParse(payload);
    if (move.error) return null;

    switch (move.data.type) {
      case "roll":
        return resolveMonopolyTurn(state, playerIndex, rollDice(), "roll");
      case "pay_bail":
        return resolveMonopolyTurn(state, playerIndex, rollDice(), "pay_bail");
      case "use_get_out_of_jail_card":
        return resolveMonopolyTurn(state, playerIndex, rollDice(), "use_get_out_of_jail_card");
      case "buy_property":
      case "pass_property":
        return resolvePropertyDecision(state, playerIndex, move.data.type);
      case "end_turn":
        return resolveEndTurn(state, playerIndex);
      case "build_house":
        return resolveBuildHouse(state, playerIndex, move.data.spaceId);
      case "build_hotel":
        return resolveBuildHotel(state, playerIndex, move.data.spaceId);
      case "mortgage_property":
        return resolveMortgageProperty(state, playerIndex, move.data.spaceId);
      case "unmortgage_property":
        return resolveUnmortgageProperty(state, playerIndex, move.data.spaceId);
    }
  },
  isDone: (state) => state.phase === "finished",
  viewAs: (state) => state,
  tagView: (view) => ({ type: "monopoly", view }),
  describeMove: (_prevState, newState, payload) => {
    const move = zMonopolyMove.parse(payload);
    if (move.type === "end_turn") {
      return " ended their turn";
    }
    return describeTurn(newState.lastTurnEvents);
  },
};

export const monopolyGameService = new GameService<MonopolyGameState, MonopolyGameState>(
  monopolyLogic,
);
