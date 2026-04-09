import { z } from "zod";
import { type SafeUserInfo } from "./user.types.ts";

export const REACTION_EMOJIS = ["👍", "😂", "😡"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
export const zReactionEmoji = z.enum(REACTION_EMOJIS);

export interface MessageReactionInfo {
  emoji: ReactionEmoji;
  reactedBy: SafeUserInfo[];
}

/**
 * Represents a chat message as exposed to the client
 * - `messageId`: database key
 * - `text`: message contents
 * - `createdBy`: message sender
 * - `createdAt`: when the message was sent
 * - `reactions`: emoji reactions on this message
 */
export interface MessageInfo {
  messageId: string;
  text: string;
  createdBy: SafeUserInfo;
  createdAt: Date;
  reactions: MessageReactionInfo[];
}

/*** TYPES USED IN THE MESSAGE API ***/

/**
 * Relevant information for creating a new message
 */
export type NewMessagePayload = z.infer<typeof zNewMessageRequest>;
export const zNewMessageRequest = z.object({
  chatId: z.string(),
  text: z.string(),
});

export type ToggleMessageReactionPayload = z.infer<typeof zToggleMessageReactionRequest>;
export const zToggleMessageReactionRequest = z.object({
  chatId: z.string(),
  messageId: z.string(),
  emoji: zReactionEmoji,
});
