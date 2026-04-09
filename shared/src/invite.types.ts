import { z } from "zod";

/**
 * Invite status lifecycle values.
 */
export type InviteStatus = z.infer<typeof zInviteStatus>;
export const zInviteStatus = z.union([
  z.literal("pending"),
  z.literal("accepted"),
  z.literal("declined"),
  z.literal("expired"),
  z.literal("canceled"),
]);

/**
 * Game type for invites. Kept separate from current GameKey values because
 * "monopoly" is planned but not yet added as a playable game key.
 */
export type InviteGameType = z.infer<typeof zInviteGameType>;
export const zInviteGameType = z.literal("monopoly");

/**
 * Invite shape exposed through the API.
 * - `inviterUsername`: display name of the user who sent the invite
 */
export interface InviteInfo {
  inviteId: string;
  roomId: string;
  gameType: InviteGameType;
  inviterId: string;
  inviteeId: string;
  inviterUsername: string;
  status: InviteStatus;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  respondedAt?: Date;
  canceledAt?: Date;
}
export const zInviteInfo = z.object({
  inviteId: z.string(),
  roomId: z.string(),
  gameType: zInviteGameType,
  inviterId: z.string(),
  inviteeId: z.string(),
  inviterUsername: z.string(),
  status: zInviteStatus,
  createdAt: z.date(),
  updatedAt: z.date(),
  expiresAt: z.date(),
  respondedAt: z.date().optional(),
  canceledAt: z.date().optional(),
});
export const zInviteInfoList = z.array(zInviteInfo);

/*** TYPES USED IN THE INVITE API ***/

/**
 * Payload for sending a new invite.
 */
export type CreateInvitePayload = z.infer<typeof zCreateInvitePayload>;
export const zCreateInvitePayload = z.object({
  roomId: z.string(),
  inviteeUsername: z.string(),
});

/**
 * Payload for invite list retrieval.
 */
export type InviteListPayload = z.infer<typeof zInviteListPayload>;
export const zInviteListPayload = z.object({
  includeHistory: z.boolean().optional(),
});

/**
 * Empty payload for authenticated invite actions that only need route params.
 */
export type EmptyInvitePayload = z.infer<typeof zEmptyInvitePayload>;
export const zEmptyInvitePayload = z.object({});
