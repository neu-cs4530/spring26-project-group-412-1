import {
  type InviteInfo,
  withAuth,
  zCreateInvitePayload,
  zEmptyInvitePayload,
  zInviteListPayload,
} from "@gamenite/shared";
import { type Response } from "express";
import { type RestAPI, type GameServerSocket } from "../types.ts";
import { checkAuth } from "../services/auth.service.ts";
import {
  acceptInvite,
  cancelInvite,
  createInvite,
  declineInvite,
  getInvitesForInvitee,
  getInvitesForInviter,
} from "../services/invite.service.ts";
import { getGameById } from "../services/game.service.ts";
import { io } from "../app.ts";
import { z } from "zod";

function sendInviteError<R>(res: Response<R | { error: string }>, message: string) {
  if (message === "Invite is expired") {
    res.status(410).send({ error: message });
    return;
  }
  if (
    message === "Room not found" ||
    message === "Invite not found" ||
    message === "Invitee not found" ||
    message.includes("invalid game")
  ) {
    res.status(404).send({ error: message });
    return;
  }
  if (message.includes("Not authorized") || message.includes("Only the room host")) {
    res.status(403).send({ error: message });
    return;
  }
  if (
    message.includes("Duplicate pending invite") ||
    message.includes("Room is full") ||
    message.includes("Invitee is already in the room") ||
    message.includes("Cannot invite to an active game") ||
    message.includes("joining full") ||
    message.includes("joining game that started") ||
    message.includes("joining game they are in already") ||
    message.startsWith("Invite is ")
  ) {
    res.status(409).send({ error: message });
    return;
  }

  res.status(400).send({ error: message });
}

/**
 * Handle socket registration join a personal room so the server can push
 * invite notifications to this specific user.
 */
export const socketRegisterUser = (socket: GameServerSocket) => async (body: unknown) => {
  try {
    const { auth } = withAuth(z.object({}).strict()).parse(body);
    const user = await checkAuth(auth);
    if (!user) return;
    await socket.join(`user:${user.username}`);
  } catch {
    // ignore auth failures silently
  }
};

/**
 * Handle POST requests to `/api/invite/send`.
 */
export const postSend: RestAPI<InviteInfo> = async (req, res) => {
  const body = withAuth(zCreateInvitePayload).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  try {
    const invite = await createInvite(
      user,
      body.data.payload.roomId,
      body.data.payload.inviteeUsername,
      new Date(),
    );

    // Push a real-time notification to the invitee's personal socket room
    io.to(`user:${body.data.payload.inviteeUsername}`).emit("inviteReceived", invite);

    res.send(invite);
  } catch (err) {
    sendInviteError(res, err instanceof Error ? err.message : "Unexpected invite error");
  }
};

/**
 * Handle POST requests to `/api/invite/mine`.
 */
export const postMine: RestAPI<InviteInfo[]> = async (req, res) => {
  const body = withAuth(zInviteListPayload).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  res.send(await getInvitesForInvitee(user, new Date(), body.data.payload.includeHistory ?? false));
};

/**
 * Compatibility endpoint for GET /api/invite/list.
 * Expects auth in query params.
 */
export const getList: RestAPI<InviteInfo[]> = async (req, res) => {
  const query = z
    .object({
      username: z.string(),
      password: z.string(),
      includeHistory: z.coerce.boolean().optional(),
    })
    .safeParse(req.query);
  if (!query.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = await checkAuth({ username: query.data.username, password: query.data.password });
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  res.send(await getInvitesForInvitee(user, new Date(), query.data.includeHistory ?? false));
};

/**
 * Handle POST requests to `/api/invite/sent`.
 */
export const postSent: RestAPI<InviteInfo[]> = async (req, res) => {
  const body = withAuth(zInviteListPayload).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  res.send(await getInvitesForInviter(user, new Date(), body.data.payload.includeHistory ?? true));
};

/**
 * Handle POST requests to `/api/invite/:id/accept`.
 */
export const postByIdAccept: RestAPI<InviteInfo, { id: string }> = async (req, res) => {
  const body = withAuth(zEmptyInvitePayload).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  try {
    const invite = await acceptInvite(req.params.id, user, new Date());
    io.to(`user:${invite.inviterUsername}`).emit("inviteStatusUpdated", invite);

    // Notify all game watchers so the host's player list (and Start Game button) updates
    const updatedGame = await getGameById(invite.roomId);
    if (updatedGame) {
      io.to(invite.roomId).emit("gamePlayersUpdated", updatedGame.players);
    }

    res.send(invite);
  } catch (err) {
    sendInviteError(res, err instanceof Error ? err.message : "Unexpected invite error");
  }
};
export const postAccept = postByIdAccept;

/**
 * Handle POST requests to `/api/invite/:id/decline`.
 */
export const postByIdDecline: RestAPI<InviteInfo, { id: string }> = async (req, res) => {
  const body = withAuth(zEmptyInvitePayload).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  try {
    const invite = await declineInvite(req.params.id, user, new Date());
    io.to(`user:${invite.inviterUsername}`).emit("inviteStatusUpdated", invite);
    res.send(invite);
  } catch (err) {
    sendInviteError(res, err instanceof Error ? err.message : "Unexpected invite error");
  }
};
export const postDecline = postByIdDecline;

/**
 * Handle POST requests to `/api/invite/:id/cancel`.
 */
export const postByIdCancel: RestAPI<InviteInfo, { id: string }> = async (req, res) => {
  const body = withAuth(zEmptyInvitePayload).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  try {
    const invite = await cancelInvite(req.params.id, user, new Date());
    io.to(`user:${invite.inviteeUsername}`).emit("inviteStatusUpdated", invite);
    res.send(invite);
  } catch (err) {
    sendInviteError(res, err instanceof Error ? err.message : "Unexpected invite error");
  }
};

export const postCreate = postSend;
