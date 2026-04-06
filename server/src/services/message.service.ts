import { type MessageInfo, type ReactionEmoji } from "@gamenite/shared";
import { populateSafeUserInfo } from "./user.service.ts";
import { type UserWithId } from "../types.ts";
import { MessageRepo } from "../repository.ts";

const messageLocks = new Map<string, Promise<void>>();

async function withMessageLock<T>(messageId: string, action: () => Promise<T>): Promise<T> {
  const previous = messageLocks.get(messageId) ?? Promise.resolve();

  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });

  messageLocks.set(
    messageId,
    previous.then(() => current),
  );

  await previous;
  try {
    return await action();
  } finally {
    release();
    if (messageLocks.get(messageId) === current) {
      messageLocks.delete(messageId);
    }
  }
}

/**
 * Expand a stored message
 *
 * @param messageId - Valid message id
 * @returns the expanded message info object
 */
async function populateMessageInfo(messageId: string): Promise<MessageInfo> {
  const message = await MessageRepo.get(messageId);
  return {
    messageId,
    text: message.text,
    createdAt: new Date(message.createdAt),
    createdBy: await populateSafeUserInfo(message.createdBy),
    reactions: await Promise.all(
      (message.reactions ?? []).map(async (reaction) => ({
        emoji: reaction.emoji,
        reactedBy: await Promise.all(
          reaction.userIds.map(async (userId) => populateSafeUserInfo(userId)),
        ),
      })),
    ),
  };
}

/**
 * Creates and stores a new message
 *
 * @param user - a valid user
 * @param text - the message's text
 * @param createdAt - the time of message creation
 * @returns the message's info object
 */
export async function createMessage(
  user: UserWithId,
  text: string,
  createdAt: Date,
): Promise<MessageInfo> {
  const messageId = await MessageRepo.add({
    text,
    createdAt: createdAt.toISOString(),
    createdBy: user.userId,
    reactions: [],
  });
  return populateMessageInfo(messageId);
}

export async function toggleMessageReaction(
  user: UserWithId,
  messageId: string,
  emoji: ReactionEmoji,
): Promise<{ message: MessageInfo; action: "added" | "removed" }> {
  return withMessageLock(messageId, async () => {
    const message = await MessageRepo.find(messageId);
    if (!message) {
      throw new Error(`user ${user.username} reacted to invalid message id`);
    }

    const reactions = [...(message.reactions ?? [])];

    const reactionsWithoutUser = reactions
      .map((reaction) => {
        if (!reaction.userIds.includes(user.userId)) return reaction;
        return {
          ...reaction,
          userIds: reaction.userIds.filter((userId) => userId !== user.userId),
        };
      })
      .filter((reaction) => reaction.userIds.length > 0);

    const hadSameEmoji = reactions.some(
      (reaction) => reaction.emoji === emoji && reaction.userIds.includes(user.userId),
    );

    const nextReactions = hadSameEmoji
      ? reactionsWithoutUser
      : (() => {
          const sameEmojiReaction = reactionsWithoutUser.find(
            (reaction) => reaction.emoji === emoji,
          );
          if (sameEmojiReaction) {
            return reactionsWithoutUser.map((reaction) =>
              reaction.emoji === emoji
                ? {
                    ...reaction,
                    userIds: [...reaction.userIds, user.userId],
                  }
                : reaction,
            );
          }
          return [...reactionsWithoutUser, { emoji, userIds: [user.userId] }];
        })();

    await MessageRepo.set(messageId, {
      ...message,
      reactions: nextReactions,
    });

    return {
      message: await populateMessageInfo(messageId),
      action: hadSameEmoji ? "removed" : "added",
    };
  });
}

/**
 * Retrieves a list of message ids from the database
 *
 * @param ids - A list of valid message ids
 * @returns the MessageInfo objects corresponding to those ids
 * @throws if any of the ids are not valid
 */
export async function getMessagesById(ids: string[]): Promise<MessageInfo[]> {
  return Promise.all(ids.map(populateMessageInfo));
}
