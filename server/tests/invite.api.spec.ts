import { randomUUID } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import supertest, { type Response } from "supertest";
import { app } from "../src/app.ts";

let response: Response;

const auth1 = { username: "user1", password: "pwd1111" };
const auth2 = { username: "user2", password: "pwd2222" };
const auth3 = { username: "user3", password: "pwd3333" };
const authBad = { username: "user1", password: "wrong" };

async function createRoomAsUser1() {
  const create = await supertest(app)
    .post("/api/game/create")
    .send({ auth: auth1, payload: "nim" });
  expect(create.status).toBe(200);
  return create.body.gameId as string;
}

describe("POST /api/invite/send", () => {
  it("returns 400 on malformed payload", async () => {
    response = await supertest(app)
      .post("/api/invite/send")
      .send({
        auth: auth1,
        payload: { roomId: 42, inviteeUsername: "user2" },
      });
    expect(response.status).toBe(400);
  });

  it("returns 403 on invalid auth", async () => {
    response = await supertest(app)
      .post("/api/invite/send")
      .send({
        auth: authBad,
        payload: { roomId: "room", inviteeUsername: "user2" },
      });
    expect(response.status).toBe(403);
  });

  it("allows host to send invite and blocks non-host sender", async () => {
    const roomId = await createRoomAsUser1();

    response = await supertest(app)
      .post("/api/invite/send")
      .send({
        auth: auth3,
        payload: { roomId, inviteeUsername: "user2" },
      });
    expect(response.status).toBe(403);

    response = await supertest(app)
      .post("/api/invite/send")
      .send({
        auth: auth1,
        payload: { roomId, inviteeUsername: "user2" },
      });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      inviteId: expect.any(String),
      roomId,
      gameType: "monopoly",
      status: "pending",
    });
  });

  it("blocks duplicate pending invite for same room and invitee", async () => {
    const roomId = await createRoomAsUser1();
    await supertest(app)
      .post("/api/invite/send")
      .send({
        auth: auth1,
        payload: { roomId, inviteeUsername: "user2" },
      });

    response = await supertest(app)
      .post("/api/invite/send")
      .send({
        auth: auth1,
        payload: { roomId, inviteeUsername: "user2" },
      });
    expect(response.status).toBe(409);
    expect(response.body.error).toContain("Duplicate pending invite");
  });
});

describe("POST /api/invite/mine", () => {
  it("returns pending invite for invitee", async () => {
    const roomId = await createRoomAsUser1();
    const sent = await supertest(app)
      .post("/api/invite/send")
      .send({
        auth: auth1,
        payload: { roomId, inviteeUsername: "user2" },
      });
    expect(sent.status).toBe(200);

    response = await supertest(app).post("/api/invite/mine").send({
      auth: auth2,
      payload: {},
    });
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      inviteId: sent.body.inviteId,
      status: "pending",
      roomId,
    });
  });
});

describe("POST /api/invite/sent", () => {
  it("returns invite history for the inviter", async () => {
    const roomId = await createRoomAsUser1();
    const sent = await supertest(app)
      .post("/api/invite/send")
      .send({
        auth: auth1,
        payload: { roomId, inviteeUsername: "user2" },
      });
    expect(sent.status).toBe(200);

    response = await supertest(app)
      .post("/api/invite/sent")
      .send({
        auth: auth1,
        payload: { includeHistory: true },
      });
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      inviteId: sent.body.inviteId,
      status: "pending",
      roomId,
    });
  });
});

describe("invite actions", () => {
  it("accepts invite and removes it from actionable list", async () => {
    const roomId = await createRoomAsUser1();
    const sent = await supertest(app)
      .post("/api/invite/send")
      .send({
        auth: auth1,
        payload: { roomId, inviteeUsername: "user2" },
      });
    expect(sent.status).toBe(200);

    response = await supertest(app).post(`/api/invite/${sent.body.inviteId}/accept`).send({
      auth: auth2,
      payload: {},
    });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("accepted");

    response = await supertest(app).post("/api/invite/mine").send({
      auth: auth2,
      payload: {},
    });
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(0);
  });

  it("declines invite and supports inviter cancel on another invite", async () => {
    const roomId = await createRoomAsUser1();
    const first = await supertest(app)
      .post("/api/invite/send")
      .send({
        auth: auth1,
        payload: { roomId, inviteeUsername: "user2" },
      });
    expect(first.status).toBe(200);

    response = await supertest(app).post(`/api/invite/${first.body.inviteId}/decline`).send({
      auth: auth2,
      payload: {},
    });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("declined");

    const second = await supertest(app)
      .post("/api/invite/send")
      .send({
        auth: auth1,
        payload: { roomId, inviteeUsername: "user2" },
      });
    expect(second.status).toBe(200);

    response = await supertest(app).post(`/api/invite/${second.body.inviteId}/cancel`).send({
      auth: auth1,
      payload: {},
    });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("canceled");
  });

  it("returns 404 on unknown invite id", async () => {
    response = await supertest(app).post(`/api/invite/${randomUUID().toString()}/accept`).send({
      auth: auth2,
      payload: {},
    });
    expect(response.status).toBe(404);
  });
});

describe("POST /api/invite/send - additional error cases", () => {
  it("returns 404 when the room does not exist", async () => {
    response = await supertest(app)
      .post("/api/invite/send")
      .send({
        auth: auth1,
        payload: { roomId: randomUUID(), inviteeUsername: "user2" },
      });
    expect(response.status).toBe(404);
    expect(response.body.error).toContain("Room not found");
  });

  it("returns 404 when the invitee username does not exist", async () => {
    const roomId = await createRoomAsUser1();
    response = await supertest(app)
      .post("/api/invite/send")
      .send({
        auth: auth1,
        payload: { roomId, inviteeUsername: "no-such-user" },
      });
    expect(response.status).toBe(404);
    expect(response.body.error).toContain("Invitee not found");
  });

  it("returns 409 when the invitee is already a player in the room", async () => {
    // use guess (unlimited players) so the room-full check does not fire first
    const createGuess = await supertest(app)
      .post("/api/game/create")
      .send({ auth: auth1, payload: "guess" });
    expect(createGuess.status).toBe(200);
    const roomId = createGuess.body.gameId as string;

    const sent = await supertest(app)
      .post("/api/invite/send")
      .send({ auth: auth1, payload: { roomId, inviteeUsername: "user2" } });
    expect(sent.status).toBe(200);

    await supertest(app)
      .post(`/api/invite/${sent.body.inviteId}/accept`)
      .send({ auth: auth2, payload: {} });

    response = await supertest(app)
      .post("/api/invite/send")
      .send({ auth: auth1, payload: { roomId, inviteeUsername: "user2" } });
    expect(response.status).toBe(409);
    expect(response.body.error).toContain("Invitee is already in the room");
  });

  it("returns 409 when the room is already full", async () => {
    // nim has maxPlayers = 2; host fills the room by inviting and having user2 accept
    const roomId = await createRoomAsUser1();

    const sent = await supertest(app)
      .post("/api/invite/send")
      .send({ auth: auth1, payload: { roomId, inviteeUsername: "user2" } });
    expect(sent.status).toBe(200);

    await supertest(app)
      .post(`/api/invite/${sent.body.inviteId}/accept`)
      .send({ auth: auth2, payload: {} });

    response = await supertest(app)
      .post("/api/invite/send")
      .send({ auth: auth1, payload: { roomId, inviteeUsername: "user3" } });
    expect(response.status).toBe(409);
    expect(response.body.error).toContain("Room is full");
  });
});

describe("POST /api/invite/mine - error cases", () => {
  it("returns 400 on malformed body", async () => {
    response = await supertest(app).post("/api/invite/mine").send({});
    expect(response.status).toBe(400);
  });

  it("returns 403 on invalid auth", async () => {
    response = await supertest(app)
      .post("/api/invite/mine")
      .send({ auth: authBad, payload: {} });
    expect(response.status).toBe(403);
  });
});

describe("POST /api/invite/sent - error cases", () => {
  it("returns 400 on malformed body", async () => {
    response = await supertest(app).post("/api/invite/sent").send({});
    expect(response.status).toBe(400);
  });

  it("returns 403 on invalid auth", async () => {
    response = await supertest(app)
      .post("/api/invite/sent")
      .send({ auth: authBad, payload: {} });
    expect(response.status).toBe(403);
  });
});

describe("GET /api/invite/list", () => {
  it("returns 400 when query params are missing", async () => {
    response = await supertest(app).get("/api/invite/list");
    expect(response.status).toBe(400);
  });

  it("returns 403 on invalid credentials", async () => {
    response = await supertest(app).get("/api/invite/list?username=user1&password=wrong");
    expect(response.status).toBe(403);
  });

  it("returns pending invites for the authenticated user", async () => {
    const roomId = await createRoomAsUser1();
    await supertest(app)
      .post("/api/invite/send")
      .send({ auth: auth1, payload: { roomId, inviteeUsername: "user2" } });

    response = await supertest(app).get("/api/invite/list?username=user2&password=pwd2222");
    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThanOrEqual(1);
  });
});

describe("invite action endpoint - additional error cases", () => {
  it("returns 400 for malformed accept body", async () => {
    response = await supertest(app).post("/api/invite/fake-id/accept").send({});
    expect(response.status).toBe(400);
  });

  it("returns 403 for invalid auth on accept", async () => {
    response = await supertest(app)
      .post("/api/invite/fake-id/accept")
      .send({ auth: authBad, payload: {} });
    expect(response.status).toBe(403);
  });

  it("returns 400 for malformed decline body", async () => {
    response = await supertest(app).post("/api/invite/fake-id/decline").send({});
    expect(response.status).toBe(400);
  });

  it("returns 403 for invalid auth on decline", async () => {
    response = await supertest(app)
      .post("/api/invite/fake-id/decline")
      .send({ auth: authBad, payload: {} });
    expect(response.status).toBe(403);
  });

  it("returns 400 for malformed cancel body", async () => {
    response = await supertest(app).post("/api/invite/fake-id/cancel").send({});
    expect(response.status).toBe(400);
  });

  it("returns 403 for invalid auth on cancel", async () => {
    response = await supertest(app)
      .post("/api/invite/fake-id/cancel")
      .send({ auth: authBad, payload: {} });
    expect(response.status).toBe(403);
  });

  it("returns 409 when acting on an already-declined invite", async () => {
    const roomId = await createRoomAsUser1();
    const sent = await supertest(app)
      .post("/api/invite/send")
      .send({ auth: auth1, payload: { roomId, inviteeUsername: "user2" } });
    expect(sent.status).toBe(200);

    await supertest(app).post(`/api/invite/${sent.body.inviteId}/decline`).send({
      auth: auth2,
      payload: {},
    });

    // Try to accept the already-declined invite → 409
    response = await supertest(app).post(`/api/invite/${sent.body.inviteId}/accept`).send({
      auth: auth2,
      payload: {},
    });
    expect(response.status).toBe(409);
    expect(response.body.error).toContain("Invite is declined");
  });
});

describe("invite action error cases", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 410 when accepting an invite that has already expired", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const roomId = await createRoomAsUser1();

    const sent = await supertest(app)
      .post("/api/invite/send")
      .send({ auth: auth1, payload: { roomId, inviteeUsername: "user2" } });
    expect(sent.status).toBe(200);

    // advance past the 5-minute TTL
    vi.advanceTimersByTime(6 * 60 * 1000);

    response = await supertest(app).post(`/api/invite/${sent.body.inviteId}/accept`).send({
      auth: auth2,
      payload: {},
    });
    expect(response.status).toBe(410);
    expect(response.body.error).toContain("Invite is expired");
  });

  it("returns 403 when a non-invitee tries to decline an invite", async () => {
    const roomId = await createRoomAsUser1();
    const sent = await supertest(app)
      .post("/api/invite/send")
      .send({ auth: auth1, payload: { roomId, inviteeUsername: "user2" } });
    expect(sent.status).toBe(200);

    // user3 is not the invitee and should be rejected
    response = await supertest(app).post(`/api/invite/${sent.body.inviteId}/decline`).send({
      auth: auth3,
      payload: {},
    });
    expect(response.status).toBe(403);
    expect(response.body.error).toContain("Not authorized");
  });

  it("returns 403 when the invitee tries to cancel (only the inviter may cancel)", async () => {
    const roomId = await createRoomAsUser1();
    const sent = await supertest(app)
      .post("/api/invite/send")
      .send({ auth: auth1, payload: { roomId, inviteeUsername: "user2" } });
    expect(sent.status).toBe(200);

    // user2 is the invitee, not the inviter, so cancel must be rejected
    response = await supertest(app).post(`/api/invite/${sent.body.inviteId}/cancel`).send({
      auth: auth2,
      payload: {},
    });
    expect(response.status).toBe(403);
    expect(response.body.error).toContain("Not authorized");
  });
});
