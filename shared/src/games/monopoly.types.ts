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
export interface OwnableSpace {
  spaceId: number;      // 0-39, position on board
  name: string;
  type: "property" | "railroad" | "utility";
  price: number;
  rent: number;         // base rent, keep simple for now
  ownerId?: string;     // userId of owner, undefined if unowned
  colorGroup?: string;  // e.g. "brown", "red" (only applies to properties)
}

/**
 * A non-ownable space on the board such as Go, Jail, Free Parking, etc.
 */
export interface SpecialSpace {
  spaceId: number;
  name: string;
  type: Exclude<BoardSpaceType, "property" | "railroad" | "utility">;
}

/**
 * A space on the board is either ownable or special.
 */
export type BoardSpace = OwnableSpace | SpecialSpace;

/**
 * Represents a single player's state during a Monopoly game.
 */
export interface MonopolyPlayer {
  userId: string;
  username: string;
  money: number;
  position: number;     // 0-39, index on board
  isBankrupt: boolean;
}

/**
 * The full state of a Monopoly game at any point in time.
 * This is what gets persisted and synced between players.
 */
export interface MonopolyGameState {
  players: MonopolyPlayer[];
  board: BoardSpace[];
  currentPlayerIndex: number;   // index into players array, whose turn it is
  phase: "waiting" | "playing" | "finished";
  winnerId?: string;            // userId of winner, only set when phase is "finished"
  diceRoll?: [number, number];  // the last dice roll, shown to all players
}
