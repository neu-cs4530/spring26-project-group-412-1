import "./MessageList.css";
import useLoginContext from "../hooks/useLoginContext.ts";
import type { ChatMessage } from "../util/types.ts";
import { useEffect, useRef, useState } from "react";
import useTimeSince from "../hooks/useTimeSince.ts";
import UserLink from "./UserLink.tsx";
import { REACTION_EMOJIS, type MessageInfo, type ReactionEmoji } from "@gamenite/shared";

interface MessageListProps {
  messages: ChatMessage[];
  handleToggleReaction: (messageId: string, emoji: ReactionEmoji) => void;
}

function hasCurrentUserReaction(
  message: MessageInfo,
  username: string,
  emoji: ReactionEmoji,
): boolean {
  return message.reactions.some(
    (reaction) =>
      reaction.emoji === emoji && reaction.reactedBy.some((user) => user.username === username),
  );
}

export default function MessageList({ messages, handleToggleReaction }: MessageListProps) {
  const { user } = useLoginContext();
  const chatWindowRef = useRef<HTMLDivElement | null>(null);
  const timeSince = useTimeSince();
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);
  useEffect(() => {
    if (!chatWindowRef.current) return;
    chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
  }, [messages]);

  return (
    <div className="chatWindow" ref={chatWindowRef}>
      <div className="chatScroller">
        {messages.map((message) => {
          if ("meta" in message) {
            if (message.meta === "move") {
              const isMyMove = message.user.username === user.username;
              const moveDescription =
                isMyMove && message.moveDescription === " ended their turn"
                  ? " ended your turn"
                  : message.moveDescription;

              return (
                <div key={message.messageId} className="chatMoveLog">
                  {isMyMove ? "You" : <UserLink user={message.user} />}
                  {moveDescription}
                </div>
              );
            }
            if (message.meta === "reaction") {
              return (
                <div key={message.messageId} className="chatMeta">
                  <UserLink user={message.user} /> reacted with {message.emoji}{" "}
                  {timeSince(message.dateTime)}
                </div>
              );
            }
            return (
              <div key={message.messageId} className="chatMeta">
                <UserLink user={message.user} /> {message.meta}
                {" chat "}
                {timeSince(message.dateTime)}
              </div>
            );
          }
          if (user.username === message.createdBy.username) {
            return (
              <div key={message.messageId} className="chatMe">
                <div className="chatSender">{timeSince(message.createdAt)}</div>
                <div className="chatContent">{message.text}</div>
                <div className="chatActions">
                  <button
                    type="button"
                    className="chatReactionToggle"
                    onClick={() =>
                      setReactionPickerMessageId((current) =>
                        current === message.messageId ? null : message.messageId,
                      )
                    }
                  >
                    React
                  </button>
                </div>
                {reactionPickerMessageId === message.messageId && (
                  <div className="chatReactionPicker">
                    {REACTION_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="chatReactionChoice"
                        onClick={() => {
                          handleToggleReaction(message.messageId, emoji);
                          setReactionPickerMessageId(null);
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="chatReactionCancel"
                      onClick={() => setReactionPickerMessageId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {message.reactions.length > 0 && (
                  <div className="chatReactionSummary">
                    {message.reactions.map((reaction) => (
                      <button
                        key={`${message.messageId}-${reaction.emoji}`}
                        type="button"
                        className="chatReactionBadge"
                        data-active={hasCurrentUserReaction(message, user.username, reaction.emoji)}
                        onClick={() => handleToggleReaction(message.messageId, reaction.emoji)}
                      >
                        {reaction.emoji} {reaction.reactedBy.length}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          return (
            <div key={message.messageId} className="chatOther">
              <div className="chatSender">
                <UserLink user={message.createdBy} /> {timeSince(message.createdAt)}
              </div>
              <div className="chatContent">{message.text}</div>
              <div className="chatActions">
                <button
                  type="button"
                  className="chatReactionToggle"
                  onClick={() =>
                    setReactionPickerMessageId((current) =>
                      current === message.messageId ? null : message.messageId,
                    )
                  }
                >
                  React
                </button>
              </div>
              {reactionPickerMessageId === message.messageId && (
                <div className="chatReactionPicker">
                  {REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="chatReactionChoice"
                      onClick={() => {
                        handleToggleReaction(message.messageId, emoji);
                        setReactionPickerMessageId(null);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="chatReactionCancel"
                    onClick={() => setReactionPickerMessageId(null)}
                  >
                    Cancel
                  </button>
                </div>
              )}
              {message.reactions.length > 0 && (
                <div className="chatReactionSummary">
                  {message.reactions.map((reaction) => (
                    <button
                      key={`${message.messageId}-${reaction.emoji}`}
                      type="button"
                      className="chatReactionBadge"
                      data-active={hasCurrentUserReaction(message, user.username, reaction.emoji)}
                      onClick={() => handleToggleReaction(message.messageId, reaction.emoji)}
                    >
                      {reaction.emoji} {reaction.reactedBy.length}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
