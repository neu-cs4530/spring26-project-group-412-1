import { withAuth, zNewMessageRequest, zToggleMessageReactionRequest, zBoardReactionRequest } from "@gamenite/shared";
import { type SocketAPI } from "../types.ts";
import { z } from "zod";
import { addMessageToChat, addReactionLogToChat, forceChatById } from "../services/chat.service.ts";
import { populateSafeUserInfo } from "../services/user.service.ts";
import { createMessage, toggleMessageReaction } from "../services/message.service.ts";
import { logSocketError } from "./socket.controller.ts";
import { enforceAuth } from "../services/auth.service.ts";

/**
 * Handle a socket request to join a chat: send the connection the chat's
 * current contents and signal to everyone in the chat that the user has joined.
 */
export const socketJoin: SocketAPI = (socket) => async (body) => {
  try {
    const { auth, payload: chatId } = withAuth(z.string()).parse(body);
    const user = await enforceAuth(auth);
    const chat = await forceChatById(chatId, user);
    await socket.join(chatId);
    socket.emit("chatJoined", chat);
    socket
      .to(chatId)
      .emit("chatUserJoined", { chatId, user: await populateSafeUserInfo(user.userId) });
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Handle a socket request to leave a chat: stop sending that socket messages
 * about the chat and send everyone else a message that they left.
 */
export const socketLeave: SocketAPI = (socket) => async (body) => {
  try {
    const { auth, payload: chatId } = withAuth(z.string()).parse(body);
    const user = await enforceAuth(auth);
    if (!socket.rooms.has(chatId)) {
      throw new Error(`user ${user.username} left chat they weren't in`);
    }
    await socket.leave(chatId);
    socket
      .to(chatId)
      .emit("chatUserLeft", { chatId, user: await populateSafeUserInfo(user.userId) });
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Handle a socket request to send a message to the chat: store the message and
 * let everyone know about it.
 */
export const socketSendMessage: SocketAPI = (socket, io) => async (body) => {
  try {
    const {
      auth,
      payload: { chatId, text },
    } = withAuth(zNewMessageRequest).parse(body);
    const user = await enforceAuth(auth);
    const now = new Date();
    const message = await createMessage(user, text, now);
    await addMessageToChat(chatId, user, message.messageId);
    io.to(chatId).emit("chatNewMessage", { chatId, message });
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Handle a socket request to add, change, or remove a reaction on a message.
 */
export const socketToggleReaction: SocketAPI = (socket, io) => async (body) => {
  try {
    const {
      auth,
      payload: { chatId, messageId, emoji },
    } = withAuth(zToggleMessageReactionRequest).parse(body);
    const user = await enforceAuth(auth);
    const now = new Date();
    const result = await toggleMessageReaction(user, messageId, emoji);

    if (result.action === "added") {
      await addReactionLogToChat(chatId, messageId, emoji, user, now);
    }

    io.to(chatId).emit("chatReactionUpdated", {
      chatId,
      message: result.message,
      user: await populateSafeUserInfo(user.userId),
      emoji,
      action: result.action,
      createdAt: now,
    });
  } catch (err) {
    logSocketError(socket, err);
  }
};

/**
 * Handle a board reaction: broadcast the emoji to everyone in the chat room.
 */
export const socketBoardReaction: SocketAPI = (socket, io) => async (body) => {
  try {
    const {
      auth,
      payload: { chatId, emoji },
    } = withAuth(zBoardReactionRequest).parse(body);
    const user = await enforceAuth(auth);
    io.to(chatId).emit("gameBoardReactionBroadcast", { username: user.username, emoji });
  } catch (err) {
    logSocketError(socket, err);
  }
};
