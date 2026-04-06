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
  mortgaged?: boolean;
  colorGroup: string;
  mortgageValue?: number;
  houseCost?: number;
  houseCount?: number;
  hotelCount?: number;
  rentSchedule?: [number, number, number, number, number, number];
}

export interface RailroadSpace {
  spaceId: number;
  name: string;
  type: "railroad";
  price: number;
  rent: number;
  ownerIndex?: number;
  mortgaged?: boolean;
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
  mortgaged?: boolean;
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
  chanceGetOutOfJailFreeCards: number;
  communityChestGetOutOfJailFreeCards: number;
}

export type MonopolyDeckKind = "chance" | "community_chest";
export type MonopolyTurnPhase = "awaiting_roll" | "awaiting_purchase" | "awaiting_end_turn";

export type MonopolyCardEffect =
  | { type: "move_to_space"; spaceId: number }
  | { type: "move_by"; spaces: number }
  | {
      type: "move_to_nearest";
      spaceType: "railroad" | "utility";
      rentMultiplier?: number;
      utilityMultiplierOverride?: number;
    }
  | { type: "go_to_jail" }
  | { type: "receive_money"; amount: number; source: string }
  | { type: "pay_money"; amount: number; source: string }
  | { type: "collect_from_each_player"; amount: number; source: string }
  | { type: "pay_each_player"; amount: number; source: string }
  | { type: "get_out_of_jail_free" };

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
      type: "paid_money";
      amount: number;
      source: string;
    }
  | {
      type: "received_money";
      amount: number;
      source: string;
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
    }
  | {
      type: "received_get_out_of_jail_card";
      deck: MonopolyDeckKind;
    }
  | {
      type: "used_get_out_of_jail_card";
      deck: MonopolyDeckKind;
    }
  | {
      type: "property_available";
      spaceId: number;
      spaceName: string;
      price: number;
    }
  | {
      type: "property_purchased";
      spaceId: number;
      spaceName: string;
      price: number;
    }
  | {
      type: "property_purchase_skipped";
      spaceId: number;
      spaceName: string;
    }
  | {
      type: "paid_rent";
      amount: number;
      spaceId: number;
      spaceName: string;
      ownerIndex: number;
    }
  | {
      type: "built_house";
      spaceId: number;
      spaceName: string;
      houseCount: number;
      amount: number;
    }
  | {
      type: "built_hotel";
      spaceId: number;
      spaceName: string;
      amount: number;
    }
  | {
      type: "mortgaged_property";
      spaceId: number;
      spaceName: string;
      amount: number;
    }
  | {
      type: "unmortgaged_property";
      spaceId: number;
      spaceName: string;
      amount: number;
    }
  | {
      type: "bankruptcy";
      playerIndex: number;
      creditorIndex?: number;
      reason: string;
    }
  | {
      type: "won_game";
      winnerIndex: number;
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
  z.object({
    type: z.literal("use_get_out_of_jail_card"),
  }),
  z.object({
    type: z.literal("buy_property"),
  }),
  z.object({
    type: z.literal("pass_property"),
  }),
  z.object({
    type: z.literal("end_turn"),
  }),
  z.object({
    type: z.literal("build_house"),
    spaceId: z.number(),
  }),
  z.object({
    type: z.literal("build_hotel"),
    spaceId: z.number(),
  }),
  z.object({
    type: z.literal("mortgage_property"),
    spaceId: z.number(),
  }),
  z.object({
    type: z.literal("unmortgage_property"),
    spaceId: z.number(),
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
  turnPhase: MonopolyTurnPhase;
  pendingPropertyId?: number;
  extraTurn: boolean;
  consecutiveDoubles: number;
  winnerIndex?: number;
  diceRoll?: [number, number];
  chanceCursor: number;
  communityChestCursor: number;
  chanceGetOutOfJailFreeAvailable: boolean;
  communityChestGetOutOfJailFreeAvailable: boolean;
  lastTurnEvents: MonopolyTurnEvent[];
}
