import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import supertest, { type Response } from "supertest";
import { app } from "../src/app.ts";
import { MAX_PROFILE_PHOTO_BYTES } from "../src/services/user.service.ts";

let response: Response;
const validPng = Buffer.from("89504E470D0A1A0A0000000D49484452", "hex");
const invalidFile = Buffer.from("not an image", "utf8");

const auth1 = { username: "user1", password: "pwd1111" };
const user1 = { username: "user1", display: "Yāo" };

const auth2 = { username: "user2", password: "pwd2222" };
const user2 = { username: "user2", display: "Sénior Dos" };

describe("GET /api/user/:id", () => {
  it("should 404 for nonexistent users", async () => {
    response = await supertest(app).get(`/api/user/${randomUUID().toString()}`);
    expect(response.status).toBe(404);
    expect(response.body).toStrictEqual({ error: "User not found" });
  });

  it("should return existing users", async () => {
    response = await supertest(app).get(`/api/user/user1`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ...user1, createdAt: expect.anything() });

    response = await supertest(app).get(`/api/user/user2`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ...user2, createdAt: expect.anything() });
  });
});

describe("POST /api/user/login", () => {
  it("should return 400 on ill-formed payload", async () => {
    response = await supertest(app)
      .post("/api/user/login")
      .send({ ...auth1, password: 3 });
    expect(response.status).toBe(400);
  });

  it("should return the same response if user does not exist or if user exists and password is wrong", async () => {
    const expectedResponse = { error: "Invalid username or password" };

    response = await supertest(app)
      .post("/api/user/login")
      .send({ ...auth1, password: "no" });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual(expectedResponse);

    response = await supertest(app)
      .post("/api/user/login")
      .send({ ...auth1, username: randomUUID().toString() });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual(expectedResponse);
  });

  it("should accept a correct username/password combination", async () => {
    response = await supertest(app).post("/api/user/login").send(auth1);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ...user1, createdAt: expect.anything() });
  });
});

describe("POST/api/user/:username", () => {
  it("should return 400 on ill-formed payloads", async () => {
    response = await supertest(app).post("/api/user/user1").send({ auth: auth1, payload: 4 });
    expect(response.status).toBe(400);
  });

  it("should reject invalid authorization", async () => {
    response = await supertest(app)
      .post("/api/user/user1")
      .send({ auth: { ...auth1, password: "wrong" }, payload: { display: "New User 1 Display?" } });
    expect(response.status).toBe(403);
  });

  it("requires the authorization to match the route", async () => {
    response = await supertest(app)
      .post("/api/user/user1")
      .send({ auth: auth2, payload: { display: "New User 1 Display!" } });
    expect(response.status).toBe(403);
  });

  it("should update individual parts of a user correctly", async () => {
    response = await supertest(app)
      .post("/api/user/user1")
      .send({ auth: auth1, payload: { display: "New User 1 Display" } });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ...user1,
      display: "New User 1 Display",
      createdAt: expect.anything(),
    });

    response = await supertest(app)
      .post("/api/user/user1")
      .send({ auth: auth1, payload: { display: "New User 1 Display" } });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ...user1,
      display: "New User 1 Display",
      createdAt: expect.anything(),
    });

    response = await supertest(app)
      .post("/api/user/user1")
      .send({ auth: auth1, payload: { password: "new_password_1" } });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ...user1,
      display: "New User 1 Display",
      createdAt: expect.anything(),
    });

    response = await supertest(app)
      .post("/api/user/user1")
      .send({ auth: auth1, payload: { password: "new_password_1" } });

    expect(response.status).toBe(403);

    response = await supertest(app)
      .post("/api/user/user1")
      .send({
        auth: { ...auth1, password: "new_password_1" },
        payload: { display: "Newer User 1 Display" },
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ...user1,
      display: "Newer User 1 Display",
      createdAt: expect.anything(),
    });
  });
});

describe("POST /api/user/:username/photo", () => {
  it("uploads a valid image when auth matches the route user", async () => {
    response = await supertest(app)
      .post("/api/user/user1/photo")
      .field("authUsername", auth1.username)
      .field("authPassword", auth1.password)
      .attach("photo", validPng, { filename: "photo.png", contentType: "image/png" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ...user1,
      createdAt: expect.anything(),
      profilePhoto: {
        mimeType: "image/png",
        dataBase64: validPng.toString("base64"),
        sizeBytes: validPng.length,
      },
    });
  });

  it("rejects upload when auth is missing or malformed", async () => {
    response = await supertest(app)
      .post("/api/user/user1/photo")
      .field("authUsername", auth1.username)
      .attach("photo", validPng, { filename: "photo.png", contentType: "image/png" });

    expect(response.status).toBe(400);

    response = await supertest(app)
      .post("/api/user/user1/photo")
      .field("authUsername", auth1.username)
      .field("authPassword", "wrong")
      .attach("photo", validPng, { filename: "photo.png", contentType: "image/png" });

    expect(response.status).toBe(403);
  });

  it("rejects upload when route username does not match auth username", async () => {
    response = await supertest(app)
      .post("/api/user/user1/photo")
      .field("authUsername", auth2.username)
      .field("authPassword", auth2.password)
      .attach("photo", validPng, { filename: "photo.png", contentType: "image/png" });

    expect(response.status).toBe(403);
  });

  it("rejects upload if no file is provided", async () => {
    response = await supertest(app)
      .post("/api/user/user1/photo")
      .field("authUsername", auth1.username)
      .field("authPassword", auth1.password);

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "No profile photo uploaded" });
  });

  it("rejects unsupported content type", async () => {
    response = await supertest(app)
      .post("/api/user/user1/photo")
      .field("authUsername", auth1.username)
      .field("authPassword", auth1.password)
      .attach("photo", invalidFile, { filename: "photo.txt", contentType: "text/plain" });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("content type must be one of");
  });

  it("rejects file larger than configured max size", async () => {
    const tooLargePng = Buffer.alloc(MAX_PROFILE_PHOTO_BYTES + 1);
    validPng.copy(tooLargePng);

    response = await supertest(app)
      .post("/api/user/user1/photo")
      .field("authUsername", auth1.username)
      .field("authPassword", auth1.password)
      .attach("photo", tooLargePng, { filename: "large.png", contentType: "image/png" });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({
      error: `Profile photo exceeds maximum size of 2 MB`,
    });
  });
});

describe("POST /api/user/signup", () => {
  const password = "pwd";

  it("should create a user given valid arguments", async () => {
    const username = randomUUID().toString();
    response = await supertest(app).post("/api/user/signup").send({ username, password });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      username,
      display: username,
      createdAt: expect.anything(),
    });
  });

  it("should return 400 on ill-formed payload", async () => {
    const username = randomUUID().toString();
    response = await supertest(app).post("/api/user/signup").send({ username });
    expect(response.status).toBe(400);
  });

  it("should return error if trying to make an existing user", async () => {
    const username = randomUUID().toString();
    await supertest(app).post("/api/user/signup").send({ username, password });

    response = await supertest(app).post("/api/user/signup").send({ username, password });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ error: "User already exists" });
  });
});

describe("POST /api/user/list", () => {
  it("should return 400 on ill-formed payload", async () => {
    response = await supertest(app).post("/api/user/list").send(auth1);
    expect(response.status).toBe(400);
  });

  it("should indicate an error if usernames do not exist", async () => {
    response = await supertest(app).post("/api/user/list").send(["user1", randomUUID().toString()]);
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ error: "Usernames do not all exist" });
  });

  it("accepts the empty list", async () => {
    response = await supertest(app).post("/api/user/list").send([]);
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual([]);
  });

  it("accepts valid usernames and returns appropriate responses", async () => {
    response = await supertest(app).post("/api/user/list").send(["user2", "user1"]);
    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({ ...user2, createdAt: expect.anything() }),
      expect.objectContaining({ ...user1, createdAt: expect.anything() }),
    ]);
  });

  it("accepts duplicates and returns users in the order provided", async () => {
    response = await supertest(app).post("/api/user/list").send(["user1", "user2", "user1"]);
    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({ ...user1, createdAt: expect.anything() }),
      expect.objectContaining({ ...user2, createdAt: expect.anything() }),
      expect.objectContaining({ ...user1, createdAt: expect.anything() }),
    ]);
  });
});
