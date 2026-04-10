/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/naming-convention */
import { describe, expect, it, vi } from "vitest";
import request from "supertest";

const mockIo = {
  on: vi.fn(),
};

vi.mock("socket.io", () => {
  return {
    Server: class {
      constructor() {
        return mockIo;
      }
    },
  };
});

const chatSocketJoin = vi.fn(() => vi.fn());
const chatSocketLeave = vi.fn(() => vi.fn());
const chatSocketSendMessage = vi.fn(() => vi.fn());
const chatSocketToggleReaction = vi.fn(() => vi.fn());
const chatSocketBoardReaction = vi.fn(() => vi.fn());

const gameSocketJoinAsPlayer = vi.fn(() => vi.fn());
const gameSocketMakeMove = vi.fn(() => vi.fn());
const gameSocketStart = vi.fn(() => vi.fn());
const gameSocketWatch = vi.fn(() => vi.fn());

const inviteSocketRegisterUser = vi.fn(() => vi.fn());

vi.mock("../src/controllers/chat.controller.ts", () => ({
  socketJoin: chatSocketJoin,
  socketLeave: chatSocketLeave,
  socketSendMessage: chatSocketSendMessage,
  socketToggleReaction: chatSocketToggleReaction,
  socketBoardReaction: chatSocketBoardReaction,
}));

vi.mock("../src/controllers/game.controller.ts", () => ({
  postCreate: (_req: any, res: any) => res.status(200).json({ route: "game/create" }),
  getList: (_req: any, res: any) => res.status(200).json({ route: "game/list" }),
  getById: (req: any, res: any) => res.status(200).json({ route: "game/id", id: req.params.id }),
  socketJoinAsPlayer: gameSocketJoinAsPlayer,
  socketMakeMove: gameSocketMakeMove,
  socketStart: gameSocketStart,
  socketWatch: gameSocketWatch,
}));

vi.mock("../src/controllers/invite.controller.ts", () => ({
  getList: (_req: any, res: any) => res.status(200).json({ route: "invite/list" }),
  postCreate: (_req: any, res: any) => res.status(200).json({ route: "invite/create" }),
  postSend: (_req: any, res: any) => res.status(200).json({ route: "invite/send" }),
  postMine: (_req: any, res: any) => res.status(200).json({ route: "invite/mine" }),
  postSent: (_req: any, res: any) => res.status(200).json({ route: "invite/sent" }),
  postByIdAccept: (req: any, res: any) =>
    res.status(200).json({ route: "invite/accept", id: req.params.id }),
  postByIdDecline: (req: any, res: any) =>
    res.status(200).json({ route: "invite/decline", id: req.params.id }),
  postByIdCancel: (req: any, res: any) =>
    res.status(200).json({ route: "invite/cancel", id: req.params.id }),
  socketRegisterUser: inviteSocketRegisterUser,
}));

vi.mock("../src/controllers/thread.controller.ts", () => ({
  postCreate: (_req: any, res: any) => res.status(200).json({ route: "thread/create" }),
  getList: (_req: any, res: any) => res.status(200).json({ route: "thread/list" }),
  getById: (req: any, res: any) => res.status(200).json({ route: "thread/id", id: req.params.id }),
  postByIdComment: (req: any, res: any) =>
    res.status(200).json({ route: "thread/comment", id: req.params.id }),
}));

const profilePhotoUploadMiddleware = vi.fn((_req: any, _res: any, next: any) => next());

vi.mock("../src/controllers/user.controller.ts", () => ({
  postList: (_req: any, res: any) => res.status(200).json({ route: "user/list" }),
  postLogin: (_req: any, res: any) => res.status(200).json({ route: "user/login" }),
  postSignup: (_req: any, res: any) => res.status(200).json({ route: "user/signup" }),
  profilePhotoUploadMiddleware,
  postByUsernamePhoto: (req: any, res: any) =>
    res.status(200).json({ route: "user/photo", username: req.params.username }),
  postByUsername: (req: any, res: any) =>
    res.status(200).json({ route: "user/postByUsername", username: req.params.username }),
  getByUsername: (req: any, res: any) =>
    res.status(200).json({ route: "user/getByUsername", username: req.params.username }),
}));

const { app, io } = await import("../src/app.ts");

type FakeSocket = {
  id: string;
  on: ReturnType<typeof vi.fn>;
  onAny: ReturnType<typeof vi.fn>;
  onAnyOutgoing: ReturnType<typeof vi.fn>;
};

describe("app.ts", () => {
  it("wires the main API routes correctly", async () => {
    const gameCreate = await request(app).post("/api/game/create").send({});
    expect(gameCreate.status).toBe(200);
    expect(gameCreate.body).toEqual({ route: "game/create" });

    const gameList = await request(app).get("/api/game/list");
    expect(gameList.status).toBe(200);
    expect(gameList.body).toEqual({ route: "game/list" });

    const gameById = await request(app).get("/api/game/abc123");
    expect(gameById.status).toBe(200);
    expect(gameById.body).toEqual({ route: "game/id", id: "abc123" });

    const inviteList = await request(app).get("/api/invite/list");
    expect(inviteList.status).toBe(200);
    expect(inviteList.body).toEqual({ route: "invite/list" });

    const inviteCreate = await request(app).post("/api/invite/create").send({});
    expect(inviteCreate.status).toBe(200);
    expect(inviteCreate.body).toEqual({ route: "invite/create" });

    const inviteSend = await request(app).post("/api/invite/send").send({});
    expect(inviteSend.status).toBe(200);
    expect(inviteSend.body).toEqual({ route: "invite/send" });

    const inviteMine = await request(app).post("/api/invite/mine").send({});
    expect(inviteMine.status).toBe(200);
    expect(inviteMine.body).toEqual({ route: "invite/mine" });

    const inviteSent = await request(app).post("/api/invite/sent").send({});
    expect(inviteSent.status).toBe(200);
    expect(inviteSent.body).toEqual({ route: "invite/sent" });

    const accept = await request(app).post("/api/invite/invite-1/accept").send({});
    expect(accept.status).toBe(200);
    expect(accept.body).toEqual({ route: "invite/accept", id: "invite-1" });

    const decline = await request(app).post("/api/invite/invite-2/decline").send({});
    expect(decline.status).toBe(200);
    expect(decline.body).toEqual({ route: "invite/decline", id: "invite-2" });

    const cancel = await request(app).post("/api/invite/invite-3/cancel").send({});
    expect(cancel.status).toBe(200);
    expect(cancel.body).toEqual({ route: "invite/cancel", id: "invite-3" });

    const threadCreate = await request(app).post("/api/thread/create").send({});
    expect(threadCreate.status).toBe(200);
    expect(threadCreate.body).toEqual({ route: "thread/create" });

    const threadList = await request(app).get("/api/thread/list");
    expect(threadList.status).toBe(200);
    expect(threadList.body).toEqual({ route: "thread/list" });

    const threadById = await request(app).get("/api/thread/thread-1");
    expect(threadById.status).toBe(200);
    expect(threadById.body).toEqual({ route: "thread/id", id: "thread-1" });

    const threadComment = await request(app).post("/api/thread/thread-1/comment").send({});
    expect(threadComment.status).toBe(200);
    expect(threadComment.body).toEqual({ route: "thread/comment", id: "thread-1" });

    const userList = await request(app).post("/api/user/list").send({});
    expect(userList.status).toBe(200);
    expect(userList.body).toEqual({ route: "user/list" });

    const login = await request(app).post("/api/user/login").send({});
    expect(login.status).toBe(200);
    expect(login.body).toEqual({ route: "user/login" });

    const signup = await request(app).post("/api/user/signup").send({});
    expect(signup.status).toBe(200);
    expect(signup.body).toEqual({ route: "user/signup" });

    const uploadPhoto = await request(app).post("/api/user/alice/photo").send({});
    expect(uploadPhoto.status).toBe(200);
    expect(uploadPhoto.body).toEqual({ route: "user/photo", username: "alice" });
    expect(profilePhotoUploadMiddleware).toHaveBeenCalled();

    const postByUsername = await request(app).post("/api/user/bob").send({});
    expect(postByUsername.status).toBe(200);
    expect(postByUsername.body).toEqual({ route: "user/postByUsername", username: "bob" });

    const getByUsername = await request(app).get("/api/user/carol");
    expect(getByUsername.status).toBe(200);
    expect(getByUsername.body).toEqual({ route: "user/getByUsername", username: "carol" });
  });

  it("registers the socket connection handler when the app module loads", () => {
    expect(io).toBe(mockIo);
    expect(mockIo.on).toHaveBeenCalledWith("connection", expect.any(Function));
  });

  it("registers all socket listeners and logs valid incoming and outgoing events", () => {
    inviteSocketRegisterUser.mockClear();
    chatSocketJoin.mockClear();
    chatSocketLeave.mockClear();
    chatSocketSendMessage.mockClear();
    chatSocketToggleReaction.mockClear();
    chatSocketBoardReaction.mockClear();
    gameSocketJoinAsPlayer.mockClear();
    gameSocketMakeMove.mockClear();
    gameSocketStart.mockClear();
    gameSocketWatch.mockClear();

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const connectionHandler = mockIo.on.mock.calls.find((call) => call[0] === "connection")?.[1] as
      | ((socket: FakeSocket) => void)
      | undefined;

    expect(connectionHandler).toBeTypeOf("function");

    const on = vi.fn();
    const onAny = vi.fn();
    const onAnyOutgoing = vi.fn();

    const fakeSocket: FakeSocket = {
      id: "socket-123",
      on,
      onAny,
      onAnyOutgoing,
    };

    connectionHandler?.(fakeSocket);

    expect(consoleSpy).toHaveBeenCalledWith("CONN [socket-123] connected");

    expect(inviteSocketRegisterUser).toHaveBeenCalledWith(fakeSocket);
    expect(chatSocketJoin).toHaveBeenCalledWith(fakeSocket, mockIo);
    expect(chatSocketLeave).toHaveBeenCalledWith(fakeSocket, mockIo);
    expect(chatSocketSendMessage).toHaveBeenCalledWith(fakeSocket, mockIo);
    expect(chatSocketToggleReaction).toHaveBeenCalledWith(fakeSocket, mockIo);
    expect(chatSocketBoardReaction).toHaveBeenCalledWith(fakeSocket, mockIo);

    expect(gameSocketJoinAsPlayer).toHaveBeenCalledWith(fakeSocket, mockIo);
    expect(gameSocketMakeMove).toHaveBeenCalledWith(fakeSocket, mockIo);
    expect(gameSocketStart).toHaveBeenCalledWith(fakeSocket, mockIo);
    expect(gameSocketWatch).toHaveBeenCalledWith(fakeSocket, mockIo);

    expect(on).toHaveBeenCalledWith("disconnect", expect.any(Function));
    expect(on).toHaveBeenCalledWith("userRegister", expect.any(Function));
    expect(on).toHaveBeenCalledWith("chatJoin", expect.any(Function));
    expect(on).toHaveBeenCalledWith("chatLeave", expect.any(Function));
    expect(on).toHaveBeenCalledWith("chatSendMessage", expect.any(Function));
    expect(on).toHaveBeenCalledWith("chatToggleReaction", expect.any(Function));
    expect(on).toHaveBeenCalledWith("gameBoardReaction", expect.any(Function));
    expect(on).toHaveBeenCalledWith("gameJoinAsPlayer", expect.any(Function));
    expect(on).toHaveBeenCalledWith("gameMakeMove", expect.any(Function));
    expect(on).toHaveBeenCalledWith("gameStart", expect.any(Function));
    expect(on).toHaveBeenCalledWith("gameWatch", expect.any(Function));

    expect(onAny).toHaveBeenCalledWith(expect.any(Function));
    expect(onAnyOutgoing).toHaveBeenCalledWith(expect.any(Function));

    const disconnectHandler = on.mock.calls.find((call) => call[0] === "disconnect")?.[1] as
      | (() => void)
      | undefined;
    expect(disconnectHandler).toBeDefined();
    disconnectHandler?.();

    expect(consoleSpy).toHaveBeenCalledWith("CONN [socket-123] disconnected");

    const onAnyHandler = onAny.mock.calls[0]?.[0] as
      | ((name: string, payload: unknown) => void)
      | undefined;
    expect(onAnyHandler).toBeDefined();

    onAnyHandler?.("chatSendMessage", {
      auth: { username: "alice" },
      payload: { text: "hello" },
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'RECV [socket-123] got chatSendMessagealice {"text":"hello"}',
    );

    onAnyHandler?.("chatSendMessage", {
      payload: { text: "bad payload" },
    });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("RECV error:"));

    const onAnyOutgoingHandler = onAnyOutgoing.mock.calls[0]?.[0] as
      | ((name: string) => void)
      | undefined;
    expect(onAnyOutgoingHandler).toBeDefined();

    onAnyOutgoingHandler?.("chatUpdated");
    expect(consoleSpy).toHaveBeenCalledWith("SEND [socket-123] gets chatUpdated");

    consoleSpy.mockRestore();
  });

  it("returns 404 for an unknown route", async () => {
    const response = await request(app).get("/definitely-not-a-real-route");
    expect(response.status).toBe(404);
  });
});
