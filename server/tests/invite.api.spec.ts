import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
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
