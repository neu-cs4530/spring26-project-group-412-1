import { afterEach, describe, expect, it, vi } from "vitest";
import { enforceAuth } from "../../src/services/auth.service.ts";
import { GameRepo, InvitePendingByRoomInviteeRepo, InviteRepo } from "../../src/repository.ts";
import { createGame, getGameById, joinGame, startGame } from "../../src/services/game.service.ts";
import {
  acceptInvite,
  cancelInvite,
  createInvite,
  declineInvite,
  getInvitesForInvitee,
  getInvitesForInviter,
} from "../../src/services/invite.service.ts";

describe("invite.service - createInvite validations", () => {
  it("throws Room not found when the room does not exist", async () => {
    const inviter = await enforceAuth({ username: "user1", password: "pwd1111" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    await expect(createInvite(inviter, "nonexistent-room-id", "user2", now)).rejects.toThrow(
      "Room not found",
    );
  });

  it("throws Invitee not found when the invitee username does not exist", async () => {
    const inviter = await enforceAuth({ username: "user1", password: "pwd1111" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(inviter, "nim", now);
    await expect(createInvite(inviter, game.gameId, "no-such-user", now)).rejects.toThrow(
      "Invitee not found",
    );
  });

  it("throws when the invitee is already a player in the room", async () => {
    const inviter = await enforceAuth({ username: "user1", password: "pwd1111" });
    const invitee = await enforceAuth({ username: "user2", password: "pwd2222" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    // guess game has null maxPlayers so the room-full check is skipped
    const game = await createGame(inviter, "guess", now);
    await joinGame(game.gameId, invitee);
    await expect(createInvite(inviter, game.gameId, "user2", now)).rejects.toThrow(
      "Invitee is already in the room",
    );
  });

  it("throws Room is full when the room has reached its maximum player count", async () => {
    const inviter = await enforceAuth({ username: "user1", password: "pwd1111" });
    const invitee = await enforceAuth({ username: "user2", password: "pwd2222" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    // nim maxPlayers = 2; after host + one joiner the room is full
    const game = await createGame(inviter, "nim", now);
    await joinGame(game.gameId, invitee);
    await expect(createInvite(inviter, game.gameId, "user3", now)).rejects.toThrow("Room is full");
  });

  it("cleans up an orphaned pending index entry when the invite record is missing", async () => {
    const inviter = await enforceAuth({ username: "user1", password: "pwd1111" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(inviter, "nim", now);
    const invite = await createInvite(inviter, game.gameId, "user2", now);
    // Delete the invite record, leaving an orphaned pending index entry
    await InviteRepo.remove(invite.inviteId);
    // Creating a new invite should succeed — the orphan is cleaned up
    const laterNow = new Date(now.getTime() + 10_000);
    const newInvite = await createInvite(inviter, game.gameId, "user2", laterNow);
    expect(newInvite.inviteId).not.toBe(invite.inviteId);
    expect(newInvite.status).toBe("pending");
  });
});

describe("invite.service - getInvitesForInviter", () => {
  it("returns invites sorted descending by creation date (exercises sort comparator)", async () => {
    const inviter = await enforceAuth({ username: "user1", password: "pwd1111" });
    const now1 = new Date("2026-01-01T00:00:00.000Z");
    const now2 = new Date("2026-01-01T01:00:00.000Z");
    // guess game has null maxPlayers so multiple invites can be sent from the same room
    const game = await createGame(inviter, "guess", now1);
    await createInvite(inviter, game.gameId, "user2", now1);
    await createInvite(inviter, game.gameId, "user3", now2);
    const sent = await getInvitesForInviter(inviter, now2, true);
    expect(sent).toHaveLength(2);
    expect(sent[0].createdAt.getTime()).toBeGreaterThan(sent[1].createdAt.getTime());
  });
});

describe("invite.service - acceptInvite / declineInvite validations", () => {
  it("throws when accepting an invite that has already expired", async () => {
    const inviter = await enforceAuth({ username: "user1", password: "pwd1111" });
    const invitee = await enforceAuth({ username: "user2", password: "pwd2222" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    // invite TTL is 5 minutes; pass a time 6 minutes later to trigger expiry
    const afterExpiry = new Date(now.getTime() + 6 * 60 * 1000);
    const game = await createGame(inviter, "nim", now);
    const invite = await createInvite(inviter, game.gameId, "user2", now);
    await expect(acceptInvite(invite.inviteId, invitee, afterExpiry)).rejects.toThrow(
      "Invite is expired",
    );
  });

  it("throws Not authorized when a non-invitee tries to decline an invite", async () => {
    const inviter = await enforceAuth({ username: "user1", password: "pwd1111" });
    const thirdParty = await enforceAuth({ username: "user3", password: "pwd3333" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(inviter, "nim", now);
    const invite = await createInvite(inviter, game.gameId, "user2", now);
    await expect(declineInvite(invite.inviteId, thirdParty, now)).rejects.toThrow("Not authorized");
  });

  it("throws Not authorized when a non-invitee tries to accept an invite", async () => {
    const inviter = await enforceAuth({ username: "user1", password: "pwd1111" });
    const thirdParty = await enforceAuth({ username: "user3", password: "pwd3333" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(inviter, "nim", now);
    const invite = await createInvite(inviter, game.gameId, "user2", now);
    await expect(acceptInvite(invite.inviteId, thirdParty, now)).rejects.toThrow(
      "Not authorized to accept this invite",
    );
  });

  it("treats already-in-game as a successful accept", async () => {
    const inviter = await enforceAuth({ username: "user1", password: "pwd1111" });
    const invitee = await enforceAuth({ username: "user2", password: "pwd2222" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    // guess game has null maxPlayers so manually joining doesn't fill the room
    const game = await createGame(inviter, "guess", now);
    const invite = await createInvite(inviter, game.gameId, "user2", now);
    await joinGame(game.gameId, invitee);
    // acceptInvite catches "joining game they are in already" and returns accepted
    const accepted = await acceptInvite(invite.inviteId, invitee, now);
    expect(accepted.status).toBe("accepted");
  });
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("invite.service", () => {
  it("prevents duplicate pending invite for same room and invitee", async () => {
    const inviter = await enforceAuth({ username: "user1", password: "pwd1111" });
    const invitee = await enforceAuth({ username: "user2", password: "pwd2222" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(inviter, "nim", now);

    await createInvite(inviter, game.gameId, "user2", now);
    await expect(
      createInvite(inviter, game.gameId, "user2", new Date(now.getTime() + 10_000)),
    ).rejects.toThrow("Duplicate pending invite");

    const invites = await getInvitesForInvitee(invitee, now, true);
    expect(invites).toHaveLength(1);
    expect(invites[0].status).toBe("pending");
  });

  it("lazily expires old pending invite and allows a new one", async () => {
    const inviter = await enforceAuth({ username: "user1", password: "pwd1111" });
    const invitee = await enforceAuth({ username: "user2", password: "pwd2222" });
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const later = new Date(createdAt.getTime() + 6 * 60 * 1000);
    const game = await createGame(inviter, "nim", createdAt);

    const first = await createInvite(inviter, game.gameId, "user2", createdAt);
    const second = await createInvite(inviter, game.gameId, "user2", later);
    expect(second.inviteId).not.toBe(first.inviteId);

    const history = await getInvitesForInvitee(invitee, later, true);
    expect(history).toHaveLength(2);
    expect(history.map((invite) => invite.status).toSorted()).toStrictEqual(["expired", "pending"]);
  });

  it("accepts invite, joins room, and marks invite accepted", async () => {
    const inviter = await enforceAuth({ username: "user1", password: "pwd1111" });
    const invitee = await enforceAuth({ username: "user2", password: "pwd2222" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(inviter, "nim", now);
    const invite = await createInvite(inviter, game.gameId, "user2", now);

    const accepted = await acceptInvite(invite.inviteId, invitee, new Date(now.getTime() + 60_000));
    expect(accepted.status).toBe("accepted");

    const updatedGame = await getGameById(game.gameId);
    expect(updatedGame).not.toBeNull();
    expect(updatedGame!.players.map((player) => player.username)).toContain("user2");

    const actionable = await getInvitesForInvitee(invitee, new Date(now.getTime() + 60_000), false);
    expect(actionable).toHaveLength(0);
  });

  it("declines invite and removes it from actionable list", async () => {
    const inviter = await enforceAuth({ username: "user1", password: "pwd1111" });
    const invitee = await enforceAuth({ username: "user2", password: "pwd2222" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(inviter, "nim", now);
    const invite = await createInvite(inviter, game.gameId, "user2", now);

    const declined = await declineInvite(
      invite.inviteId,
      invitee,
      new Date(now.getTime() + 60_000),
    );
    expect(declined.status).toBe("declined");

    const actionable = await getInvitesForInvitee(invitee, new Date(now.getTime() + 60_000), false);
    expect(actionable).toHaveLength(0);

    await expect(
      createInvite(inviter, game.gameId, "user2", new Date(now.getTime() + 90_000)),
    ).resolves.toBeDefined();
  });

  it("allows inviter to cancel, and blocks non-inviter cancellation", async () => {
    const inviter = await enforceAuth({ username: "user1", password: "pwd1111" });
    const invitee = await enforceAuth({ username: "user2", password: "pwd2222" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(inviter, "nim", now);
    const invite = await createInvite(inviter, game.gameId, "user2", now);

    await expect(
      cancelInvite(invite.inviteId, invitee, new Date(now.getTime() + 30_000)),
    ).rejects.toThrow("Not authorized");

    const canceled = await cancelInvite(invite.inviteId, inviter, new Date(now.getTime() + 60_000));
    expect(canceled.status).toBe("canceled");
  });

  it("serializes concurrent joins so only one player claims the last slot", async () => {
    const host = await enforceAuth({ username: "user1", password: "pwd1111" });
    const joiner1 = await enforceAuth({ username: "user2", password: "pwd2222" });
    const joiner2 = await enforceAuth({ username: "user3", password: "pwd3333" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(host, "nim", now);

    const originalSet = GameRepo.set.bind(GameRepo);
    const firstSetReached = deferred();
    const allowFirstSet = deferred();
    let blockedFirstSet = false;

    const setSpy = vi.spyOn(GameRepo, "set").mockImplementation(async (key, value) => {
      if (key === game.gameId && !blockedFirstSet) {
        blockedFirstSet = true;
        firstSetReached.resolve();
        await allowFirstSet.promise;
      }
      return originalSet(key, value);
    });

    const firstJoin = joinGame(game.gameId, joiner1);
    await firstSetReached.promise;
    const secondJoin = joinGame(game.gameId, joiner2);
    await Promise.resolve();

    expect(setSpy).toHaveBeenCalledTimes(1);

    allowFirstSet.resolve();

    await expect(firstJoin).resolves.toMatchObject({
      players: expect.arrayContaining([expect.objectContaining({ username: "user2" })]),
    });
    await expect(secondJoin).rejects.toThrow("joining full");

    const updatedGame = await getGameById(game.gameId);
    expect(updatedGame).not.toBeNull();
    expect(updatedGame!.players.map((player) => player.username).toSorted()).toStrictEqual([
      "user1",
      "user2",
    ]);
  });

  it("serializes invite acceptance for the last slot and expires the loser", async () => {
    const host = await enforceAuth({ username: "user1", password: "pwd1111" });
    const invitee1 = await enforceAuth({ username: "user2", password: "pwd2222" });
    const invitee2 = await enforceAuth({ username: "user3", password: "pwd3333" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(host, "nim", now);
    const invite1 = await createInvite(host, game.gameId, "user2", now);
    const invite2 = await createInvite(host, game.gameId, "user3", now);

    const originalSet = GameRepo.set.bind(GameRepo);
    const firstSetReached = deferred();
    const allowFirstSet = deferred();
    let blockedFirstSet = false;

    vi.spyOn(GameRepo, "set").mockImplementation(async (key, value) => {
      if (key === game.gameId && !blockedFirstSet) {
        blockedFirstSet = true;
        firstSetReached.resolve();
        await allowFirstSet.promise;
      }
      return originalSet(key, value);
    });

    const firstAccept = acceptInvite(invite1.inviteId, invitee1, new Date(now.getTime() + 10_000));
    await firstSetReached.promise;
    const secondAccept = acceptInvite(invite2.inviteId, invitee2, new Date(now.getTime() + 10_000));

    allowFirstSet.resolve();

    const accepted = await firstAccept;
    expect(accepted.status).toBe("accepted");
    await expect(secondAccept).rejects.toThrow("joining full");

    const invitee1History = await getInvitesForInvitee(
      invitee1,
      new Date(now.getTime() + 20_000),
      true,
    );
    const invitee2History = await getInvitesForInvitee(
      invitee2,
      new Date(now.getTime() + 20_000),
      true,
    );
    expect(invitee1History[0].status).toBe("accepted");
    expect(invitee2History[0].status).toBe("expired");

    const updatedGame = await getGameById(game.gameId);
    expect(updatedGame).not.toBeNull();
    expect(updatedGame!.players.map((player) => player.username).toSorted()).toStrictEqual([
      "user1",
      "user2",
    ]);
  });

  it("serializes duplicate invite creation attempts for the same room and invitee", async () => {
    const inviter = await enforceAuth({ username: "user1", password: "pwd1111" });
    const invitee = await enforceAuth({ username: "user2", password: "pwd2222" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(inviter, "nim", now);

    const originalPendingSet = InvitePendingByRoomInviteeRepo.set.bind(
      InvitePendingByRoomInviteeRepo,
    );
    const firstSetReached = deferred();
    const allowFirstSet = deferred();
    let blockedFirstSet = false;

    const pendingSetSpy = vi
      .spyOn(InvitePendingByRoomInviteeRepo, "set")
      .mockImplementation(async (key, value) => {
        if (!blockedFirstSet) {
          blockedFirstSet = true;
          firstSetReached.resolve();
          await allowFirstSet.promise;
        }
        return originalPendingSet(key, value);
      });

    const firstCreate = createInvite(inviter, game.gameId, "user2", now);
    await firstSetReached.promise;
    const secondCreate = createInvite(
      inviter,
      game.gameId,
      "user2",
      new Date(now.getTime() + 1_000),
    );
    await Promise.resolve();

    expect(pendingSetSpy).toHaveBeenCalledTimes(1);

    allowFirstSet.resolve();

    await expect(firstCreate).resolves.toBeDefined();
    await expect(secondCreate).rejects.toThrow("Duplicate pending invite");

    const invites = await getInvitesForInvitee(invitee, now, true);
    expect(invites).toHaveLength(1);
    expect(invites[0].status).toBe("pending");
  });

  it("prevents startGame from racing ahead of a blocked join", async () => {
    const host = await enforceAuth({ username: "user1", password: "pwd1111" });
    const joiner = await enforceAuth({ username: "user2", password: "pwd2222" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(host, "nim", now);

    const originalSet = GameRepo.set.bind(GameRepo);
    const firstSetReached = deferred();
    const allowFirstSet = deferred();
    let blockedFirstSet = false;

    const setSpy = vi.spyOn(GameRepo, "set").mockImplementation(async (key, value) => {
      if (key === game.gameId && !blockedFirstSet) {
        blockedFirstSet = true;
        firstSetReached.resolve();
        await allowFirstSet.promise;
      }
      return originalSet(key, value);
    });

    const joinPromise = joinGame(game.gameId, joiner);
    await firstSetReached.promise;
    const startPromise = startGame(game.gameId, host);
    await Promise.resolve();

    expect(setSpy).toHaveBeenCalledTimes(1);

    allowFirstSet.resolve();

    await expect(joinPromise).resolves.toBeDefined();
    await expect(startPromise).resolves.toBeDefined();

    const updatedGame = await getGameById(game.gameId);
    expect(updatedGame).not.toBeNull();
    expect(updatedGame!.status).toBe("active");
    expect(updatedGame!.players.map((player) => player.username).toSorted()).toStrictEqual([
      "user1",
      "user2",
    ]);
  });
});

describe("invite.service - host, expiry, and history edge cases", () => {
  it("blocks non-host senders and blocks invites once the room has started", async () => {
    const host = await enforceAuth({ username: "user1", password: "pwd1111" });
    const nonHost = await enforceAuth({ username: "user2", password: "pwd2222" });
    const extraPlayer = await enforceAuth({ username: "user3", password: "pwd3333" });
    const now = new Date("2026-01-02T00:00:00.000Z");

    const waitingGame = await createGame(host, "guess", now);
    await expect(createInvite(nonHost, waitingGame.gameId, "user3", now)).rejects.toThrow(
      "Only the room host can send invites",
    );

    const monopolyGame = await createGame(host, "monopoly", now);
    await joinGame(monopolyGame.gameId, extraPlayer);
    await startGame(monopolyGame.gameId, host);

    await expect(createInvite(host, monopolyGame.gameId, "user2", now)).rejects.toThrow(
      "Cannot invite to an active game",
    );
  });

  it("filters deleted and terminal invites out of the inviter's actionable list", async () => {
    const host = await enforceAuth({ username: "user1", password: "pwd1111" });
    const now = new Date("2026-01-02T01:00:00.000Z");
    const later = new Date("2026-01-02T01:01:00.000Z");

    const game = await createGame(host, "guess", now);

    const pendingInvite = await createInvite(host, game.gameId, "user2", now);
    const canceledInvite = await createInvite(host, game.gameId, "user3", later);

    await InviteRepo.remove(pendingInvite.inviteId);
    await cancelInvite(canceledInvite.inviteId, host, later);

    const actionable = await getInvitesForInviter(host, later, false);
    expect(actionable).toStrictEqual([]);
  });

  it("marks an invite expired if the room started before the invitee accepted", async () => {
    const host = await enforceAuth({ username: "user1", password: "pwd1111" });
    const invitee = await enforceAuth({ username: "user2", password: "pwd2222" });
    const extraPlayer = await enforceAuth({ username: "user3", password: "pwd3333" });
    const now = new Date("2026-01-02T02:00:00.000Z");
    const later = new Date("2026-01-02T02:01:00.000Z");

    const game = await createGame(host, "monopoly", now);
    const invite = await createInvite(host, game.gameId, "user2", now);

    await joinGame(game.gameId, extraPlayer);
    await startGame(game.gameId, host);

    await expect(acceptInvite(invite.inviteId, invitee, later)).rejects.toThrow(
      "joining game that started",
    );

    const history = await getInvitesForInvitee(invitee, later, true);
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe("expired");
  });

  it("rejects decline or cancel after the invite is no longer pending", async () => {
    const host = await enforceAuth({ username: "user1", password: "pwd1111" });
    const invitee = await enforceAuth({ username: "user2", password: "pwd2222" });
    const now = new Date("2026-01-02T03:00:00.000Z");

    const game = await createGame(host, "guess", now);

    const declinedInvite = await createInvite(host, game.gameId, "user2", now);
    await declineInvite(declinedInvite.inviteId, invitee, now);
    await expect(declineInvite(declinedInvite.inviteId, invitee, now)).rejects.toThrow(
      "Invite is declined",
    );

    const canceledInvite = await createInvite(
      host,
      game.gameId,
      "user3",
      new Date(now.getTime() + 60_000),
    );
    await cancelInvite(canceledInvite.inviteId, host, now);
    await expect(cancelInvite(canceledInvite.inviteId, host, now)).rejects.toThrow(
      "Invite is canceled",
    );
  });
});
