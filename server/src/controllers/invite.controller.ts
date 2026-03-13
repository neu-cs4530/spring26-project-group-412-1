import { type InviteInfo, withAuth } from "@gamenite/shared";
import { z } from "zod";
import { type RestAPI } from "../types.ts";
import { checkAuth } from "../services/auth.service.ts";
import {
  acceptInvite,
  createInvite,
  declineInvite,
  getInvitesForInvitee,
} from "../services/invite.service.ts";

/**
 * Handle GET /api/invite/list?username=...&password=...
 * Returns pending invites for the authenticated invitee.
 */
export const getList: RestAPI<InviteInfo[]> = async (req, res) => {
  const auth = z
    .object({
      username: z.string(),
      password: z.string(),
    })
    .safeParse(req.query);

  if (!auth.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = await checkAuth(auth.data);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  res.send(await getInvitesForInvitee(user, new Date(), false));
};

/**
 * Handle POST /api/invite/create
 * Body: { auth, payload: { roomId, inviteeUsername } }
 */
export const postCreate: RestAPI<InviteInfo> = async (req, res) => {
  const body = withAuth(
    z.object({
      roomId: z.string(),
      inviteeUsername: z.string(),
    }),
  ).safeParse(req.body);

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
    res.send(
      await createInvite(
        user,
        body.data.payload.roomId,
        body.data.payload.inviteeUsername,
        new Date(),
      ),
    );
  } catch (error) {
    res.status(400).send({
      error: error instanceof Error ? error.message : "Failed to create invite",
    });
  }
};

/**
 * Handle POST /api/invite/:id/accept
 */
export const postAccept: RestAPI<InviteInfo, { id: string }> = async (req, res) => {
  const body = withAuth(z.null()).safeParse(req.body);

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
    res.send(await acceptInvite(req.params.id, user, new Date()));
  } catch (error) {
    res.status(400).send({
      error: error instanceof Error ? error.message : "Failed to accept invite",
    });
  }
};

/**
 * Handle POST /api/invite/:id/decline
 */
export const postDecline: RestAPI<InviteInfo, { id: string }> = async (req, res) => {
  const body = withAuth(z.null()).safeParse(req.body);

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
    res.send(await declineInvite(req.params.id, user, new Date()));
  } catch (error) {
    res.status(400).send({
      error: error instanceof Error ? error.message : "Failed to decline invite",
    });
  }
};
