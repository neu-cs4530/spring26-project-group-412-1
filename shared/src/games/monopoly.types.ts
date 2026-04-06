import { z } from "zod";

/**
 * Represents the type of a single space on the Monopoly board.
 */
export type BoardSpaceType =
  | "property"
  | "railroad"
  | "utility"
  | "go"
  | "jail"
  | "go_to_jail"
  | "free_parking"
  | "tax"
  | "chance"
  | "community_chest";

/**
 * A space on the board that can be purchased and owned by a player.
 * Includes properties, railroads, and utilities.
 */
export interface PropertySpace {
  spaceId: number;
  name: string;
  type: "property";
  price: number;
  rent: number;
  ownerIndex?: number;
  colorGroup: string;
  mortgageValue?: number;
  houseCost?: number;
  rentSchedule?: [number, number, number, number, number, number];
}

export interface RailroadSpace {
  spaceId: number;
  name: string;
  type: "railroad";
  price: number;
  rent: number;
  ownerIndex?: number;
  mortgageValue?: number;
  railroadRentSchedule?: [number, number, number, number];
}

export interface UtilitySpace {
  spaceId: number;
  name: string;
  type: "utility";
  price: number;
  rent: number;
  ownerIndex?: number;
  mortgageValue?: number;
  utilityMultiplierSchedule?: [number, number];
}

/**
 * A tax space that deducts money when landed on.
 */
export interface TaxSpace {
  spaceId: number;
  name: string;
  type: "tax";
  amount: number;
}

/**
 * A non-ownable space on the board such as Go, Jail, Free Parking, etc.
 */
export interface SpecialSpace {
  spaceId: number;
  name: string;
  type: Exclude<BoardSpaceType, "property" | "railroad" | "utility" | "tax">;
}

/**
 * A space on the board is either ownable or special.
 */
export type OwnableSpace = PropertySpace | RailroadSpace | UtilitySpace;
export type BoardSpace = OwnableSpace | TaxSpace | SpecialSpace;

/**
 * Represents a single player's state during a Monopoly game.
 */
export interface MonopolyPlayer {
  money: number;
  position: number;
  isBankrupt: boolean;
  inJail: boolean;
  jailTurns: number;
}

export type MonopolyDeckKind = "chance" | "community_chest";

export type MonopolyCardEffect =
  | { type: "move_to_space"; spaceId: number }
  | { type: "move_by"; spaces: number }
  | { type: "move_to_nearest"; spaceType: "railroad" | "utility" }
  | { type: "go_to_jail" };

export interface MonopolyCard {
  id: string;
  deck: MonopolyDeckKind;
  text: string;
  effect: MonopolyCardEffect;
}

export type MonopolyTurnEvent =
  | { type: "rolled"; dice: [number, number] }
  | {
      type: "moved";
      from: number;
      to: number;
      destinationName: string;
    }
  | {
      type: "landed";
      spaceId: number;
      spaceName: string;
      spaceType: BoardSpaceType;
    }
  | {
      type: "passed_go";
      amount: number;
    }
  | {
      type: "paid_tax";
      amount: number;
      spaceId: number;
      spaceName: string;
    }
  | {
      type: "drew_card";
      deck: MonopolyDeckKind;
      cardId: string;
      cardText: string;
    }
  | {
      type: "teleported";
      from: number;
      to: number;
      destinationName: string;
      reason: MonopolyDeckKind;
    }
  | {
      type: "sent_to_jail";
      from: number;
      to: number;
      destinationName: string;
    }
  | {
      type: "stayed_in_jail";
      turnsRemaining: number;
    }
  | {
      type: "paid_bail";
      amount: number;
      automatic: boolean;
    }
  | {
      type: "left_jail";
      method: "rolled_doubles" | "paid_bail" | "automatic_bail";
    };

/**
 * The public Monopoly move contract.
 */
export type MonopolyMove = z.infer<typeof zMonopolyMove>;
export const zMonopolyMove = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("roll"),
  }),
  z.object({
    type: z.literal("pay_bail"),
  }),
]);

/**
 * The full state of a Monopoly game at any point in time.
 * This is what gets persisted and synced between players.
 */
export interface MonopolyGameState {
  players: MonopolyPlayer[];
  board: BoardSpace[];
  currentPlayerIndex: number;
  phase: "waiting" | "playing" | "finished";
  winnerIndex?: number;
  diceRoll?: [number, number];
  chanceCursor: number;
  communityChestCursor: number;
  lastTurnEvents: MonopolyTurnEvent[];
}
