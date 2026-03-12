/**
 * Build the unique key for the pending invite secondary index.
 *
 * This index encodes the uniqueness requirement:
 * at most one pending invite for a given room+invitee pair.
 */
export function pendingInviteIndexKey(roomId: string, inviteeId: string): string {
  return `${roomId}:${inviteeId}`;
}

/**
 * Build key for invitee-based invite list index.
 */
export function inviteeIndexKey(inviteeId: string): string {
  return inviteeId;
}

/**
 * Build key for inviter-based invite list index.
 */
export function inviterIndexKey(inviterId: string): string {
  return inviterId;
}
