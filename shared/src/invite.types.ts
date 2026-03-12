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
 */
export interface InviteInfo {
  inviteId: string;
  roomId: string;
  gameType: InviteGameType;
  inviterId: string;
  inviteeId: string;
  status: InviteStatus;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  respondedAt?: Date;
  canceledAt?: Date;
}
