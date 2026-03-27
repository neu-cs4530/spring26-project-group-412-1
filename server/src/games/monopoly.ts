import { GameService } from "./gameServiceManager.ts";
import { type MonopolyGameState } from "@gamenite/shared";
import { type GameLogic } from "./gameLogic.ts";
import { z } from "zod";

const STARTING_MONEY = 1500;
const BOARD_SIZE = 40;

const zMonopolyMove = z.object({
  type: z.literal("ROLL_DICE"),
});

/**
 * Initial board setup with all 40 Monopoly spaces
 */
function createInitialBoard() {
  return [
    { spaceId: 0, name: "Go", type: "go" as const },
    {
      spaceId: 1,
      name: "Mediterranean Avenue",
      type: "property" as const,
      price: 60,
      rent: 2,
      colorGroup: "brown",
    },
    { spaceId: 2, name: "Community Chest", type: "community_chest" as const },
    {
      spaceId: 3,
      name: "Baltic Avenue",
      type: "property" as const,
      price: 60,
      rent: 4,
      colorGroup: "brown",
    },
    { spaceId: 4, name: "Income Tax", type: "tax" as const },
    { spaceId: 5, name: "Reading Railroad", type: "railroad" as const, price: 200, rent: 25 },
    {
      spaceId: 6,
      name: "Oriental Avenue",
      type: "property" as const,
      price: 100,
      rent: 6,
      colorGroup: "lightblue",
    },
    { spaceId: 7, name: "Chance", type: "chance" as const },
    {
      spaceId: 8,
      name: "Vermont Avenue",
      type: "property" as const,
      price: 100,
      rent: 6,
      colorGroup: "lightblue",
    },
    {
      spaceId: 9,
      name: "Connecticut Avenue",
      type: "property" as const,
      price: 120,
      rent: 8,
      colorGroup: "lightblue",
    },
    { spaceId: 10, name: "Jail", type: "jail" as const },
    {
      spaceId: 11,
      name: "St. Charles Place",
      type: "property" as const,
      price: 140,
      rent: 10,
      colorGroup: "pink",
    },
    { spaceId: 12, name: "Electric Company", type: "utility" as const, price: 150, rent: 4 },
    {
      spaceId: 13,
      name: "States Avenue",
      type: "property" as const,
      price: 140,
      rent: 10,
      colorGroup: "pink",
    },
    {
      spaceId: 14,
      name: "Virginia Avenue",
      type: "property" as const,
      price: 160,
      rent: 12,
      colorGroup: "pink",
    },
    { spaceId: 15, name: "Pennsylvania Railroad", type: "railroad" as const, price: 200, rent: 25 },
    {
      spaceId: 16,
      name: "St. James Place",
      type: "property" as const,
      price: 180,
      rent: 14,
      colorGroup: "orange",
    },
    { spaceId: 17, name: "Community Chest", type: "community_chest" as const },
    {
      spaceId: 18,
      name: "Tennessee Avenue",
      type: "property" as const,
      price: 180,
      rent: 14,
      colorGroup: "orange",
    },
    {
      spaceId: 19,
      name: "New York Avenue",
      type: "property" as const,
      price: 200,
      rent: 16,
      colorGroup: "orange",
    },
    { spaceId: 20, name: "Free Parking", type: "free_parking" as const },
    {
      spaceId: 21,
      name: "Kentucky Avenue",
      type: "property" as const,
      price: 220,
      rent: 18,
      colorGroup: "red",
    },
    { spaceId: 22, name: "Chance", type: "chance" as const },
    {
      spaceId: 23,
      name: "Indiana Avenue",
      type: "property" as const,
      price: 220,
      rent: 18,
      colorGroup: "red",
    },
    {
      spaceId: 24,
      name: "Illinois Avenue",
      type: "property" as const,
      price: 240,
      rent: 20,
      colorGroup: "red",
    },
    { spaceId: 25, name: "B&O Railroad", type: "railroad" as const, price: 200, rent: 25 },
    {
      spaceId: 26,
      name: "Atlantic Avenue",
      type: "property" as const,
      price: 260,
      rent: 22,
      colorGroup: "yellow",
    },
    {
      spaceId: 27,
      name: "Ventnor Avenue",
      type: "property" as const,
      price: 260,
      rent: 22,
      colorGroup: "yellow",
    },
    { spaceId: 28, name: "Water Works", type: "utility" as const, price: 150, rent: 4 },
    {
      spaceId: 29,
      name: "Marvin Gardens",
      type: "property" as const,
      price: 280,
      rent: 24,
      colorGroup: "yellow",
    },
    { spaceId: 30, name: "Go To Jail", type: "go_to_jail" as const },
    {
      spaceId: 31,
      name: "Pacific Avenue",
      type: "property" as const,
      price: 300,
      rent: 26,
      colorGroup: "green",
    },
    {
      spaceId: 32,
      name: "North Carolina Avenue",
      type: "property" as const,
      price: 300,
      rent: 26,
      colorGroup: "green",
    },
    { spaceId: 33, name: "Community Chest", type: "community_chest" as const },
    {
      spaceId: 34,
      name: "Pennsylvania Avenue",
      type: "property" as const,
      price: 320,
      rent: 28,
      colorGroup: "green",
    },
    { spaceId: 35, name: "Short Line Railroad", type: "railroad" as const, price: 200, rent: 25 },
    { spaceId: 36, name: "Chance", type: "chance" as const },
    {
      spaceId: 37,
      name: "Park Place",
      type: "property" as const,
      price: 350,
      rent: 35,
      colorGroup: "darkblue",
    },
    { spaceId: 38, name: "Luxury Tax", type: "tax" as const },
    {
      spaceId: 39,
      name: "Boardwalk",
      type: "property" as const,
      price: 400,
      rent: 50,
      colorGroup: "darkblue",
    },
  ];
}

function rollDie() {
  return Math.floor(Math.random() * 6) + 1;
}

export const monopolyLogic: GameLogic<MonopolyGameState, MonopolyGameState> = {
  minPlayers: 2,
  maxPlayers: 4,

  start: (numPlayers) => ({
    players: Array.from({ length: numPlayers }, (_, i) => ({
      userId: `player${i}`,
      username: `player${i}`,
      money: STARTING_MONEY,
      position: 0,
      isBankrupt: false,
    })),
    board: createInitialBoard(),
    currentPlayerIndex: 0,
    phase: "playing",
    diceRoll: undefined,
    winnerId: undefined,
  }),

  update: (state, payload, playerIndex) => {
    const move = zMonopolyMove.safeParse(payload);
    if (move.error) return null;
    if (state.phase !== "playing") return null;
    if (playerIndex !== state.currentPlayerIndex) return null;

    const dieOne = rollDie();
    const dieTwo = rollDie();
    const total = dieOne + dieTwo;

    const currentPosition = state.players[playerIndex].position;
    const newPosition = (currentPosition + total) % BOARD_SIZE;

    const passedGo = newPosition < currentPosition || newPosition === 0;

    const updatedPlayers = state.players.map((player, index) => {
      if (index !== playerIndex) return player;

      if (newPosition === 30) {
        return {
          ...player,
          position: 10,
          money: passedGo ? player.money + 200 : player.money,
        };
      }

      return {
        ...player,
        position: newPosition,
        money: passedGo ? player.money + 200 : player.money,
      };
    });

    return {
      ...state,
      players: updatedPlayers,
      diceRoll: [dieOne, dieTwo] as [number, number],
      currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length,
    };
  },

  isDone: (state) => state.phase === "finished",

  viewAs: (state) => state,

  tagView: (view) => ({ type: "monopoly", view }),

  describeMove: (_prevState, newState, payload) => {
    const move = zMonopolyMove.safeParse(payload);
    if (!move.success) return " made a move";

    const [dieOne, dieTwo] = newState.diceRoll ?? [0, 0];
    const total = dieOne + dieTwo;
    const movedPlayerIndex =
      (newState.currentPlayerIndex + newState.players.length - 1) % newState.players.length;
    const movedPlayer = newState.players[movedPlayerIndex];
    const landedSpace = newState.board[movedPlayer.position];

    if (movedPlayer.position === 10) {
      return ` rolled ${total} and was sent to Jail`;
    }

    const prevPosition = _prevState.players[movedPlayerIndex].position;
    const passedGo = movedPlayer.position < prevPosition || movedPlayer.position === 0;

    if (passedGo) {
      return ` rolled ${total}, passed Go, collected $200, and landed on ${landedSpace?.name ?? "a space"}`;
    }

    return ` rolled ${total} and landed on ${landedSpace?.name ?? "a space"}`;
  },
};

export const monopolyGameService = new GameService<MonopolyGameState, MonopolyGameState>(
  monopolyLogic,
);
