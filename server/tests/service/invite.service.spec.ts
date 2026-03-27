import { afterEach, describe, expect, it, vi } from "vitest";
import { enforceAuth } from "../../src/services/auth.service.ts";
import { createGame, getGameById, joinGame } from "../../src/services/game.service.ts";
import {
  acceptInvite,
  cancelInvite,
  createInvite,
  declineInvite,
  getInvitesForInvitee,
} from "../../src/services/invite.service.ts";
import { GameRepo, InviteRepo } from "../../src/repository.ts";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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

  it("serializes concurrent duplicate invite creation for the same room and invitee", async () => {
    const inviter = await enforceAuth({ username: "user1", password: "pwd1111" });
    const invitee = await enforceAuth({ username: "user2", password: "pwd2222" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(inviter, "nim", now);

    const originalInviteAdd = InviteRepo.add.bind(InviteRepo);
    vi.spyOn(InviteRepo, "add").mockImplementation(async (value) => {
      await delay(10);
      return originalInviteAdd(value);
    });

    const results = await Promise.allSettled([
      createInvite(inviter, game.gameId, "user2", now),
      createInvite(inviter, game.gameId, "user2", new Date(now.getTime() + 1_000)),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(results[1].status).toBe("rejected");
    if (results[1].status === "rejected") {
      expect(`${results[1].reason}`).toContain("Duplicate pending invite");
    }

    const invites = await getInvitesForInvitee(invitee, now, true);
    expect(invites).toHaveLength(1);
    expect(invites[0].status).toBe("pending");
  });

  it("serializes concurrent joins competing for the last room slot", async () => {
    const host = await enforceAuth({ username: "user1", password: "pwd1111" });
    const user2 = await enforceAuth({ username: "user2", password: "pwd2222" });
    const user3 = await enforceAuth({ username: "user3", password: "pwd3333" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(host, "nim", now);

    const originalGameSet = GameRepo.set.bind(GameRepo);
    vi.spyOn(GameRepo, "set").mockImplementation(async (key, value) => {
      await delay(10);
      return originalGameSet(key, value);
    });

    const results = await Promise.allSettled([
      joinGame(game.gameId, user2),
      joinGame(game.gameId, user3),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

    const updatedGame = await getGameById(game.gameId);
    expect(updatedGame).not.toBeNull();
    expect(updatedGame!.players).toHaveLength(2);

    const usernames = updatedGame!.players.map((player) => player.username);
    expect(usernames).toContain("user1");
    expect(
      usernames.filter((username) => username === "user2" || username === "user3"),
    ).toHaveLength(1);
  });

  it("serializes concurrent invite acceptance for the last room slot", async () => {
    const host = await enforceAuth({ username: "user1", password: "pwd1111" });
    const user2 = await enforceAuth({ username: "user2", password: "pwd2222" });
    const user3 = await enforceAuth({ username: "user3", password: "pwd3333" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(host, "nim", now);
    const inviteForUser2 = await createInvite(host, game.gameId, "user2", now);
    const inviteForUser3 = await createInvite(host, game.gameId, "user3", now);

    const originalGameSet = GameRepo.set.bind(GameRepo);
    vi.spyOn(GameRepo, "set").mockImplementation(async (key, value) => {
      await delay(10);
      return originalGameSet(key, value);
    });

    const results = await Promise.allSettled([
      acceptInvite(inviteForUser2.inviteId, user2, new Date(now.getTime() + 60_000)),
      acceptInvite(inviteForUser3.inviteId, user3, new Date(now.getTime() + 60_000)),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

    const updatedGame = await getGameById(game.gameId);
    expect(updatedGame).not.toBeNull();
    expect(updatedGame!.players).toHaveLength(2);

    const inviteeUsernames = updatedGame!.players
      .map((player) => player.username)
      .filter((username) => username === "user2" || username === "user3");
    expect(inviteeUsernames).toHaveLength(1);

    const user2History = await getInvitesForInvitee(user2, new Date(now.getTime() + 60_000), true);
    const user3History = await getInvitesForInvitee(user3, new Date(now.getTime() + 60_000), true);
    const finalStatuses = [user2History[0]?.status, user3History[0]?.status].toSorted();
    expect(finalStatuses).toStrictEqual(["accepted", "expired"]);
  });
});
