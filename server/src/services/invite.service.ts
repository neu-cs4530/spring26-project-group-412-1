import { type InviteInfo } from "@gamenite/shared";
import {
  GameRepo,
  InviteByInviteeRepo,
  InviteByInviterRepo,
  InvitePendingByRoomInviteeRepo,
  InviteRepo,
  UserRepo,
} from "../repository.ts";
import { type InviteRecord } from "../models.ts";
import { type UserWithId } from "../types.ts";
import { getUserByUsername } from "./auth.service.ts";
import { gameServices, joinGame } from "./game.service.ts";
import { inviteeIndexKey, inviterIndexKey, pendingInviteIndexKey } from "./invite.index.service.ts";
import { gameLockKey, inviteLockKey, withKeyedLock } from "./lock.service.ts";

const INVITE_TTL_MS = 5 * 60 * 1000;

async function getInviteRecord(inviteId: string): Promise<InviteRecord> {
  const invite = await InviteRepo.find(inviteId);
  if (!invite) throw new Error("Invite not found");
  return invite;
}

/**
 * Expand a stored invite.
 */
async function populateInviteInfo(inviteId: string): Promise<InviteInfo> {
  const invite = await getInviteRecord(inviteId);
  const inviterRecord = await UserRepo.find(invite.inviterId);
  return {
    inviteId,
    roomId: invite.roomId,
    gameType: invite.gameType,
    inviterId: invite.inviterId,
    inviteeId: invite.inviteeId,
    inviterUsername: inviterRecord?.username ?? invite.inviterId,
    status: invite.status,
    createdAt: new Date(invite.createdAt),
    updatedAt: new Date(invite.updatedAt),
    expiresAt: new Date(invite.expiresAt),
    respondedAt: invite.respondedAt ? new Date(invite.respondedAt) : undefined,
    canceledAt: invite.canceledAt ? new Date(invite.canceledAt) : undefined,
  };
}

/**
 * Append invite ID to an index list, skipping duplicates.
 */
async function appendInviteIdToListIndex(
  key: string,
  inviteId: string,
  listType: "invitee" | "inviter",
): Promise<void> {
  if (listType === "invitee") {
    const existing = await InviteByInviteeRepo.find(key);
    if (!existing) {
      await InviteByInviteeRepo.set(key, { inviteIds: [inviteId] });
      return;
    }
    if (!existing.inviteIds.includes(inviteId)) {
      await InviteByInviteeRepo.set(key, { inviteIds: [...existing.inviteIds, inviteId] });
    }
    return;
  }

  const existing = await InviteByInviterRepo.find(key);
  if (!existing) {
    await InviteByInviterRepo.set(key, { inviteIds: [inviteId] });
    return;
  }
  if (!existing.inviteIds.includes(inviteId)) {
    await InviteByInviterRepo.set(key, { inviteIds: [...existing.inviteIds, inviteId] });
  }
}

/**
 * Lazily transitions a pending invite to expired if now > expiresAt.
 */
async function lazilyExpireInviteUnlocked(inviteId: string, now: Date): Promise<InviteRecord> {
  const invite = await getInviteRecord(inviteId);
  if (invite.status !== "pending") return invite;
  if (new Date(invite.expiresAt).getTime() >= now.getTime()) return invite;

  const expired: InviteRecord = {
    ...invite,
    status: "expired",
    updatedAt: now.toISOString(),
  };
  await InviteRepo.set(inviteId, expired);
  await InvitePendingByRoomInviteeRepo.remove(
    pendingInviteIndexKey(invite.roomId, invite.inviteeId),
  );
  return expired;
}

async function lazilyExpireInvite(inviteId: string, now: Date): Promise<InviteRecord> {
  return withKeyedLock(inviteLockKey(inviteId), () => lazilyExpireInviteUnlocked(inviteId, now));
}

/**
 * Create a new invite with all Sprint 1 validations and duplicate-pending
 * prevention.
 */
export async function createInvite(
  inviter: UserWithId,
  roomId: string,
  inviteeUsername: string,
  now: Date,
): Promise<InviteInfo> {
  return withKeyedLock(gameLockKey(roomId), async () => {
    const roomRecord = await GameRepo.find(roomId);
    if (!roomRecord) throw new Error("Room not found");
    const room = roomRecord;
    if (room.state) throw new Error("Cannot invite to an active game");
    if (room.createdBy !== inviter.userId) throw new Error("Only the room host can send invites");
    const maxPlayers = gameServices[room.type].maxPlayers;
    if (maxPlayers !== null && room.players.length >= maxPlayers) throw new Error("Room is full");

    const invitee = await getUserByUsername(inviteeUsername);
    if (!invitee) throw new Error("Invitee not found");
    if (room.players.some((playerId) => playerId === invitee.userId)) {
      throw new Error("Invitee is already in the room");
    }

    const pendingKey = pendingInviteIndexKey(roomId, invitee.userId);
    const existingPending = await InvitePendingByRoomInviteeRepo.find(pendingKey);
    if (existingPending) {
      const existingInvite = await InviteRepo.find(existingPending.inviteId);
      if (existingInvite) {
        const existingResolved = await lazilyExpireInviteUnlocked(existingPending.inviteId, now);
        if (existingResolved.status === "pending") {
          throw new Error("Duplicate pending invite for this room and invitee");
        }
      } else {
        await InvitePendingByRoomInviteeRepo.remove(pendingKey);
      }
    }

    const createdAtIso = now.toISOString();
    const expiresAtIso = new Date(now.getTime() + INVITE_TTL_MS).toISOString();
    const inviteId = await InviteRepo.add({
      roomId,
      gameType: "monopoly",
      inviterId: inviter.userId,
      inviteeId: invitee.userId,
      status: "pending",
      createdAt: createdAtIso,
      updatedAt: createdAtIso,
      expiresAt: expiresAtIso,
    });

    await InvitePendingByRoomInviteeRepo.set(pendingKey, {
      inviteId,
      createdAt: createdAtIso,
      expiresAt: expiresAtIso,
    });
    await appendInviteIdToListIndex(inviteeIndexKey(invitee.userId), inviteId, "invitee");
    await appendInviteIdToListIndex(inviterIndexKey(inviter.userId), inviteId, "inviter");

    return populateInviteInfo(inviteId);
  });
}

/**
 * List invites for an invitee.
 *
 * @param user - Authenticated invitee
 * @param now - Current timestamp for lazy-expiration checks
 * @param includeHistory - Include terminal states if true
 */
export async function getInvitesForInvitee(
  user: UserWithId,
  now: Date,
  includeHistory = false,
): Promise<InviteInfo[]> {
  const inviteeIndex = await InviteByInviteeRepo.find(inviteeIndexKey(user.userId));
  if (!inviteeIndex) return [];

  const infos = await Promise.all(
    inviteeIndex.inviteIds.map(async (inviteId) => {
      if (!(await InviteRepo.find(inviteId))) return null;
      await lazilyExpireInvite(inviteId, now);
      const info = await populateInviteInfo(inviteId);
      if (!includeHistory && info.status !== "pending") return null;
      return info;
    }),
  );

  return infos
    .filter((info): info is InviteInfo => info !== null)
    .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * List invites sent by an inviter.
 */
export async function getInvitesForInviter(
  user: UserWithId,
  now: Date,
  includeHistory = true,
): Promise<InviteInfo[]> {
  const inviterIndex = await InviteByInviterRepo.find(inviterIndexKey(user.userId));
  if (!inviterIndex) return [];

  const infos = await Promise.all(
    inviterIndex.inviteIds.map(async (inviteId) => {
      if (!(await InviteRepo.find(inviteId))) return null;
      await lazilyExpireInvite(inviteId, now);
      const info = await populateInviteInfo(inviteId);
      if (!includeHistory && info.status !== "pending") return null;
      return info;
    }),
  );

  return infos
    .filter((info): info is InviteInfo => info !== null)
    .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

async function updateInviteStatus(
  inviteId: string,
  updater: (invite: InviteRecord) => InviteRecord,
): Promise<InviteInfo> {
  const invite = await getInviteRecord(inviteId);
  const updated = updater(invite);
  await InviteRepo.set(inviteId, updated);
  if (updated.status !== "pending") {
    await InvitePendingByRoomInviteeRepo.remove(
      pendingInviteIndexKey(updated.roomId, updated.inviteeId),
    );
  }
  return populateInviteInfo(inviteId);
}

/**
 * Accept an invite and join the room.
 */
export async function acceptInvite(
  inviteId: string,
  invitee: UserWithId,
  now: Date,
): Promise<InviteInfo> {
  return withKeyedLock(inviteLockKey(inviteId), async () => {
    const invite = await lazilyExpireInviteUnlocked(inviteId, now);
    if (invite.inviteeId !== invitee.userId) {
      throw new Error("Not authorized to accept this invite");
    }
    if (invite.status !== "pending") throw new Error(`Invite is ${invite.status}`);

    try {
      await joinGame(invite.roomId, invitee);
    } catch (err) {
      if (err instanceof Error && err.message.includes("joining game they are in already")) {
        return updateInviteStatus(inviteId, (current) => ({
          ...current,
          status: "accepted",
          updatedAt: now.toISOString(),
          respondedAt: now.toISOString(),
        }));
      }

      if (err instanceof Error) {
        if (
          err.message.includes("invalid game") ||
          err.message.includes("joining full") ||
          err.message.includes("joining game that started")
        ) {
          await updateInviteStatus(inviteId, (current) => ({
            ...current,
            status: "expired",
            updatedAt: now.toISOString(),
          }));
        }
      }
      throw err;
    }
    return updateInviteStatus(inviteId, (current) => ({
      ...current,
      status: "accepted",
      updatedAt: now.toISOString(),
      respondedAt: now.toISOString(),
    }));
  });
}

/**
 * Decline an invite.
 */
export async function declineInvite(
  inviteId: string,
  invitee: UserWithId,
  now: Date,
): Promise<InviteInfo> {
  return withKeyedLock(inviteLockKey(inviteId), async () => {
    const invite = await lazilyExpireInviteUnlocked(inviteId, now);
    if (invite.inviteeId !== invitee.userId) {
      throw new Error("Not authorized to decline this invite");
    }
    if (invite.status !== "pending") throw new Error(`Invite is ${invite.status}`);

    return updateInviteStatus(inviteId, (current) => ({
      ...current,
      status: "declined",
      updatedAt: now.toISOString(),
      respondedAt: now.toISOString(),
    }));
  });
}

/**
 * Cancel a pending invite.
 */
export async function cancelInvite(
  inviteId: string,
  inviter: UserWithId,
  now: Date,
): Promise<InviteInfo> {
  return withKeyedLock(inviteLockKey(inviteId), async () => {
    const invite = await lazilyExpireInviteUnlocked(inviteId, now);
    if (invite.inviterId !== inviter.userId) {
      throw new Error("Not authorized to cancel this invite");
    }
    if (invite.status !== "pending") throw new Error(`Invite is ${invite.status}`);

    return updateInviteStatus(inviteId, (current) => ({
      ...current,
      status: "canceled",
      updatedAt: now.toISOString(),
      canceledAt: now.toISOString(),
    }));
  });
}
