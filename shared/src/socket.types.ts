import {
  type ChatInfo,
  type ChatMoveLogPayload,
  type ChatNewMessagePayload,
  type ChatUserJoinedPayload,
  type ChatUserLeftPayload,
} from "./chat.types.ts";
import { type NewMessagePayload, type ToggleMessageReactionPayload, type BoardReactionPayload} from "./message.types.ts";
import { type WithAuth } from "./auth.types.ts";
import { type GameMakeMovePayload, type GamePlayInfo, type TaggedGameView } from "./game.types.ts";
import { type SafeUserInfo } from "./user.types.ts";


/**
 * The Socket.io interface for client to server communication
 */
export interface ClientToServerEvents {
  chatJoin: (payload: WithAuth<string>) => void;
  chatLeave: (payload: WithAuth<string>) => void;
  chatSendMessage: (payload: WithAuth<NewMessagePayload>) => void;
  chatToggleReaction: (payload: WithAuth<ToggleMessageReactionPayload>) => void;
  gameBoardReaction: (payload: WithAuth<BoardReactionPayload>) => void;
  gameJoinAsPlayer: (payload: WithAuth<string>) => void;
  gameMakeMove: (payload: WithAuth<GameMakeMovePayload>) => void;
  gameStart: (payload: WithAuth<string>) => void;
  gameWatch: (payload: WithAuth<string>) => void;
}

/**
 * The Socket.io interface for server to client information
 */
export interface ServerToClientEvents {
  chatJoined: (payload: ChatInfo) => void;
  chatMoveLog: (payload: ChatMoveLogPayload) => void;
  chatNewMessage: (payload: ChatNewMessagePayload) => void;
  gameBoardReactionBroadcast: (payload: { username: string; emoji: string }) => void;
  chatUserJoined: (payload: ChatUserJoinedPayload) => void;
  chatUserLeft: (payload: ChatUserLeftPayload) => void;
  gamePlayersUpdated: (payload: SafeUserInfo[]) => void;
  gameStateUpdated: (payload: TaggedGameView & { forPlayer: boolean }) => void;
  gameWatched: (payload: GamePlayInfo) => void;
}
