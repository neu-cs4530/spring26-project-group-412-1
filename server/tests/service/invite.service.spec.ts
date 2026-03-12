import { describe, expect, it } from "vitest";
import { enforceAuth } from "../../src/services/auth.service.ts";
import { createGame, getGameById } from "../../src/services/game.service.ts";
import {
  acceptInvite,
  cancelInvite,
  createInvite,
  declineInvite,
  getInvitesForInvitee,
} from "../../src/services/invite.service.ts";

describe("invite.service", () => {
  it("prevents duplicate pending invite for same room and invitee", async () => {
    const inviter = await enforceAuth({ username: "user1", password: "pwd1111" });
    const invitee = await enforceAuth({ username: "user2", password: "pwd2222" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    const game = await createGame(inviter, "nim", now);

    await createInvite(inviter, game.gameId, "user2", now);
    await expect(createInvite(inviter, game.gameId, "user2", new Date(now.getTime() + 10_000)))
      .rejects.toThrow("Duplicate pending invite");

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

    const declined = await declineInvite(invite.inviteId, invitee, new Date(now.getTime() + 60_000));
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

    await expect(cancelInvite(invite.inviteId, invitee, new Date(now.getTime() + 30_000))).rejects.toThrow(
      "Not authorized",
    );

    const canceled = await cancelInvite(invite.inviteId, inviter, new Date(now.getTime() + 60_000));
    expect(canceled.status).toBe("canceled");
  });
});

