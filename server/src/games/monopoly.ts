import { GameService } from "./gameServiceManager.ts";
import { type MonopolyGameState } from "@gamenite/shared";
import { type GameLogic } from "./gameLogic.ts";
import { z } from "zod";

const STARTING_MONEY = 1500;
const BOARD_SIZE = 40;
const GO_MONEY = 200;
const INCOME_TAX = 200;
const LUXURY_TAX = 100;

const zMonopolyMove = z.object({
  type: z.literal("ROLL_DICE"),
});

type MonopolyPlayer = MonopolyGameState["players"][number];
type BoardSpace = MonopolyGameState["board"][number];

type OwnableSpace = BoardSpace & {
  price: number;
  rent: number;
  ownerId?: string;
};

function isOwnableSpace(space: BoardSpace): space is OwnableSpace {
  return space.type === "property" || space.type === "railroad" || space.type === "utility";
}

function createInitialBoard(): MonopolyGameState["board"] {
  const board: Array<
    | BoardSpace
    | (BoardSpace & {
        price: number;
        rent: number;
        ownerId?: string;
        colorGroup?: string;
      })
  > = [
    { spaceId: 0, name: "Go", type: "go" as const },
    {
      spaceId: 1,
      name: "Mediterranean Avenue",
      type: "property" as const,
      price: 60,
      rent: 2,
      colorGroup: "brown",
      ownerId: undefined,
    },
    { spaceId: 2, name: "Community Chest", type: "community_chest" as const },
    {
      spaceId: 3,
      name: "Baltic Avenue",
      type: "property" as const,
      price: 60,
      rent: 4,
      colorGroup: "brown",
      ownerId: undefined,
    },
    { spaceId: 4, name: "Income Tax", type: "tax" as const },
    {
      spaceId: 5,
      name: "Reading Railroad",
      type: "railroad" as const,
      price: 200,
      rent: 25,
      ownerId: undefined,
    },
    {
      spaceId: 6,
      name: "Oriental Avenue",
      type: "property" as const,
      price: 100,
      rent: 6,
      colorGroup: "lightblue",
      ownerId: undefined,
    },
    { spaceId: 7, name: "Chance", type: "chance" as const },
    {
      spaceId: 8,
      name: "Vermont Avenue",
      type: "property" as const,
      price: 100,
      rent: 6,
      colorGroup: "lightblue",
      ownerId: undefined,
    },
    {
      spaceId: 9,
      name: "Connecticut Avenue",
      type: "property" as const,
      price: 120,
      rent: 8,
      colorGroup: "lightblue",
      ownerId: undefined,
    },
    { spaceId: 10, name: "Jail", type: "jail" as const },
    {
      spaceId: 11,
      name: "St. Charles Place",
      type: "property" as const,
      price: 140,
      rent: 10,
      colorGroup: "pink",
      ownerId: undefined,
    },
    {
      spaceId: 12,
      name: "Electric Company",
      type: "utility" as const,
      price: 150,
      rent: 4,
      ownerId: undefined,
    },
    {
      spaceId: 13,
      name: "States Avenue",
      type: "property" as const,
      price: 140,
      rent: 10,
      colorGroup: "pink",
      ownerId: undefined,
    },
    {
      spaceId: 14,
      name: "Virginia Avenue",
      type: "property" as const,
      price: 160,
      rent: 12,
      colorGroup: "pink",
      ownerId: undefined,
    },
    {
      spaceId: 15,
      name: "Pennsylvania Railroad",
      type: "railroad" as const,
      price: 200,
      rent: 25,
      ownerId: undefined,
    },
    {
      spaceId: 16,
      name: "St. James Place",
      type: "property" as const,
      price: 180,
      rent: 14,
      colorGroup: "orange",
      ownerId: undefined,
    },
    { spaceId: 17, name: "Community Chest", type: "community_chest" as const },
    {
      spaceId: 18,
      name: "Tennessee Avenue",
      type: "property" as const,
      price: 180,
      rent: 14,
      colorGroup: "orange",
      ownerId: undefined,
    },
    {
      spaceId: 19,
      name: "New York Avenue",
      type: "property" as const,
      price: 200,
      rent: 16,
      colorGroup: "orange",
      ownerId: undefined,
    },
    { spaceId: 20, name: "Free Parking", type: "free_parking" as const },
    {
      spaceId: 21,
      name: "Kentucky Avenue",
      type: "property" as const,
      price: 220,
      rent: 18,
      colorGroup: "red",
      ownerId: undefined,
    },
    { spaceId: 22, name: "Chance", type: "chance" as const },
    {
      spaceId: 23,
      name: "Indiana Avenue",
      type: "property" as const,
      price: 220,
      rent: 18,
      colorGroup: "red",
      ownerId: undefined,
    },
    {
      spaceId: 24,
      name: "Illinois Avenue",
      type: "property" as const,
      price: 240,
      rent: 20,
      colorGroup: "red",
      ownerId: undefined,
    },
    {
      spaceId: 25,
      name: "B&O Railroad",
      type: "railroad" as const,
      price: 200,
      rent: 25,
      ownerId: undefined,
    },
    {
      spaceId: 26,
      name: "Atlantic Avenue",
      type: "property" as const,
      price: 260,
      rent: 22,
      colorGroup: "yellow",
      ownerId: undefined,
    },
    {
      spaceId: 27,
      name: "Ventnor Avenue",
      type: "property" as const,
      price: 260,
      rent: 22,
      colorGroup: "yellow",
      ownerId: undefined,
    },
    {
      spaceId: 28,
      name: "Water Works",
      type: "utility" as const,
      price: 150,
      rent: 4,
      ownerId: undefined,
    },
    {
      spaceId: 29,
      name: "Marvin Gardens",
      type: "property" as const,
      price: 280,
      rent: 24,
      colorGroup: "yellow",
      ownerId: undefined,
    },
    { spaceId: 30, name: "Go To Jail", type: "go_to_jail" as const },
    {
      spaceId: 31,
      name: "Pacific Avenue",
      type: "property" as const,
      price: 300,
      rent: 26,
      colorGroup: "green",
      ownerId: undefined,
    },
    {
      spaceId: 32,
      name: "North Carolina Avenue",
      type: "property" as const,
      price: 300,
      rent: 26,
      colorGroup: "green",
      ownerId: undefined,
    },
    { spaceId: 33, name: "Community Chest", type: "community_chest" as const },
    {
      spaceId: 34,
      name: "Pennsylvania Avenue",
      type: "property" as const,
      price: 320,
      rent: 28,
      colorGroup: "green",
      ownerId: undefined,
    },
    {
      spaceId: 35,
      name: "Short Line Railroad",
      type: "railroad" as const,
      price: 200,
      rent: 25,
      ownerId: undefined,
    },
    { spaceId: 36, name: "Chance", type: "chance" as const },
    {
      spaceId: 37,
      name: "Park Place",
      type: "property" as const,
      price: 350,
      rent: 35,
      colorGroup: "darkblue",
      ownerId: undefined,
    },
    { spaceId: 38, name: "Luxury Tax", type: "tax" as const },
    {
      spaceId: 39,
      name: "Boardwalk",
      type: "property" as const,
      price: 400,
      rent: 50,
      colorGroup: "darkblue",
      ownerId: undefined,
    },
  ];

  return board as MonopolyGameState["board"];
}

function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function countOwnedRailroads(board: MonopolyGameState["board"], ownerId: string): number {
  return board.filter(
    (space) => isOwnableSpace(space) && space.type === "railroad" && space.ownerId === ownerId,
  ).length;
}

function countOwnedUtilities(board: MonopolyGameState["board"], ownerId: string): number {
  return board.filter(
    (space) => isOwnableSpace(space) && space.type === "utility" && space.ownerId === ownerId,
  ).length;
}

function calculateRent(
  board: MonopolyGameState["board"],
  space: OwnableSpace,
  diceTotal: number,
): number {
  if (!space.ownerId) {
    return 0;
  }

  if (space.type === "railroad") {
    const railroadCount = countOwnedRailroads(board, space.ownerId);
    if (railroadCount === 1) return 25;
    if (railroadCount === 2) return 50;
    if (railroadCount === 3) return 100;
    return 200;
  }

  if (space.type === "utility") {
    const utilityCount = countOwnedUtilities(board, space.ownerId);
    return diceTotal * (utilityCount >= 2 ? 10 : 4);
  }

  return space.rent;
}

function getNextActivePlayerIndex(players: MonopolyPlayer[], currentIndex: number): number {
  let nextIndex = (currentIndex + 1) % players.length;

  while (players[nextIndex]?.isBankrupt) {
    nextIndex = (nextIndex + 1) % players.length;
  }

  return nextIndex;
}

function bankruptPlayer(
  players: MonopolyPlayer[],
  board: MonopolyGameState["board"],
  playerId: string,
): {
  players: MonopolyPlayer[];
  board: MonopolyGameState["board"];
} {
  const updatedPlayers = players.map((player) =>
    player.userId === playerId
      ? {
          ...player,
          isBankrupt: true,
          money: 0,
        }
      : player,
  );

  const updatedBoard = board.map((space) => {
    if (isOwnableSpace(space) && space.ownerId === playerId) {
      return {
        ...space,
        ownerId: undefined,
      };
    }
    return space;
  }) as MonopolyGameState["board"];

  return { players: updatedPlayers, board: updatedBoard };
}

function applyLandingEffect(
  players: MonopolyPlayer[],
  board: MonopolyGameState["board"],
  playerIndex: number,
  diceTotal: number,
): {
  players: MonopolyPlayer[];
  board: MonopolyGameState["board"];
} {
  const updatedPlayers = [...players];
  const currentPlayer = updatedPlayers[playerIndex];
  const landedSpace = board[currentPlayer.position];

  if (!landedSpace) {
    return { players: updatedPlayers, board };
  }

  if (landedSpace.type === "tax") {
    const taxAmount = landedSpace.spaceId === 38 ? LUXURY_TAX : INCOME_TAX;

    updatedPlayers[playerIndex] = {
      ...currentPlayer,
      money: currentPlayer.money - taxAmount,
    };

    return { players: updatedPlayers, board };
  }

  if (landedSpace.type === "go_to_jail") {
    updatedPlayers[playerIndex] = {
      ...currentPlayer,
      position: 10,
    };

    return { players: updatedPlayers, board };
  }

  if (!isOwnableSpace(landedSpace)) {
    return { players: updatedPlayers, board };
  }

  if (!landedSpace.ownerId) {
    if (currentPlayer.money >= landedSpace.price) {
      updatedPlayers[playerIndex] = {
        ...currentPlayer,
        money: currentPlayer.money - landedSpace.price,
      };

      const updatedBoard = board.map((space, index) =>
        index === currentPlayer.position && isOwnableSpace(space)
          ? {
              ...space,
              ownerId: currentPlayer.userId,
            }
          : space,
      ) as MonopolyGameState["board"];

      return { players: updatedPlayers, board: updatedBoard };
    }

    return { players: updatedPlayers, board };
  }

  if (landedSpace.ownerId === currentPlayer.userId) {
    return { players: updatedPlayers, board };
  }

  const ownerIndex = updatedPlayers.findIndex((player) => player.userId === landedSpace.ownerId);

  if (ownerIndex === -1 || updatedPlayers[ownerIndex]?.isBankrupt) {
    return { players: updatedPlayers, board };
  }

  const rent = calculateRent(board, landedSpace, diceTotal);

  updatedPlayers[playerIndex] = {
    ...updatedPlayers[playerIndex],
    money: updatedPlayers[playerIndex].money - rent,
  };

  updatedPlayers[ownerIndex] = {
    ...updatedPlayers[ownerIndex],
    money: updatedPlayers[ownerIndex].money + rent,
  };

  return { players: updatedPlayers, board };
}

function finalizeBankruptcyAndGameEnd(
  players: MonopolyPlayer[],
  board: MonopolyGameState["board"],
): {
  players: MonopolyPlayer[];
  board: MonopolyGameState["board"];
  phase: MonopolyGameState["phase"];
  winnerId: MonopolyGameState["winnerId"];
} {
  let updatedPlayers = [...players];
  let updatedBoard = [...board] as MonopolyGameState["board"];

  const newlyBankrupt = updatedPlayers.filter((player) => !player.isBankrupt && player.money < 0);

  for (const player of newlyBankrupt) {
    const result = bankruptPlayer(updatedPlayers, updatedBoard, player.userId);
    updatedPlayers = result.players;
    updatedBoard = result.board;
  }

  const activePlayers = updatedPlayers.filter((player) => !player.isBankrupt);

  if (activePlayers.length === 1) {
    return {
      players: updatedPlayers,
      board: updatedBoard,
      phase: "finished",
      winnerId: activePlayers[0].userId,
    };
  }

  return {
    players: updatedPlayers,
    board: updatedBoard,
    phase: "playing",
    winnerId: undefined,
  };
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
    if (!move.success) return null;
    if (state.phase !== "playing") return null;
    if (playerIndex !== state.currentPlayerIndex) return null;
    if (state.players[playerIndex]?.isBankrupt) return null;

    const dieOne = rollDie();
    const dieTwo = rollDie();
    const total = dieOne + dieTwo;

    const currentPlayer = state.players[playerIndex];
    const oldPosition = currentPlayer.position;
    const newPosition = (oldPosition + total) % BOARD_SIZE;
    const passedGo = oldPosition + total >= BOARD_SIZE;

    const movedPlayers = state.players.map((player, index) =>
      index === playerIndex
        ? {
            ...player,
            position: newPosition,
            money: player.money + (passedGo ? GO_MONEY : 0),
          }
        : player,
    );

    const landingResult = applyLandingEffect(movedPlayers, state.board, playerIndex, total);

    const finalized = finalizeBankruptcyAndGameEnd(landingResult.players, landingResult.board);

    const nextPlayerIndex =
      finalized.phase === "finished"
        ? state.currentPlayerIndex
        : getNextActivePlayerIndex(finalized.players, state.currentPlayerIndex);

    return {
      ...state,
      players: finalized.players,
      board: finalized.board,
      diceRoll: [dieOne, dieTwo] as [number, number],
      currentPlayerIndex: nextPlayerIndex,
      phase: finalized.phase,
      winnerId: finalized.winnerId,
    };
  },

  isDone: (state) => state.phase === "finished",

  viewAs: (state) => state,

  tagView: (view) => ({ type: "monopoly", view }),

  describeMove: (_prevState, newState, payload) => {
    const move = zMonopolyMove.safeParse(payload);
    if (!move.success) return " made a move";

    const actingPlayerIndex =
      (newState.currentPlayerIndex + newState.players.length - 1) % newState.players.length;
    const actingPlayer = newState.players[actingPlayerIndex];
    const landedSpace = newState.board[actingPlayer.position];
    const [dieOne, dieTwo] = newState.diceRoll ?? [0, 0];
    const total = dieOne + dieTwo;

    if (newState.phase === "finished" && newState.winnerId) {
      return ` rolled ${total}, landed on ${landedSpace?.name ?? "a space"}, and ended the game`;
    }

    return ` rolled ${total} and landed on ${landedSpace?.name ?? "a space"}`;
  },
};

export const monopolyGameService = new GameService<MonopolyGameState, MonopolyGameState>(
  monopolyLogic,
);
