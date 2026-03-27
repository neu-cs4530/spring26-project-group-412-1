import { afterEach, describe, expect, it, vi } from "vitest";
import { enforceAuth } from "../../src/services/auth.service.ts";
import { GameRepo, InvitePendingByRoomInviteeRepo } from "../../src/repository.ts";
import { createGame, getGameById, joinGame, startGame } from "../../src/services/game.service.ts";
import {
  acceptInvite,
  cancelInvite,
  createInvite,
  declineInvite,
  getInvitesForInvitee,
} from "../../src/services/invite.service.ts";

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
