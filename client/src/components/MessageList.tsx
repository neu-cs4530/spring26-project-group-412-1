import "./MessageList.css";
import useLoginContext from "../hooks/useLoginContext.ts";
import type { ChatMessage } from "../util/types.ts";
import { useEffect, useRef, useState } from "react";
import useTimeSince from "../hooks/useTimeSince.ts";
import UserLink from "./UserLink.tsx";
import type { Reaction } from "../hooks/useSocketsForChat.ts";

const REACTIONS = ["👍", "😄", "😮", "😢", "😡"];

interface MessageListProps {
  messages: ChatMessage[];
  reactions: Record<string, Reaction[]>;
  handleReact: (messageId: string, emoji: string) => void;
}

export default function MessageList({ messages, reactions, handleReact }: MessageListProps) {
  const { user } = useLoginContext();
  const chatWindowRef = useRef<HTMLDivElement | null>(null);
  const timeSince = useTimeSince();
  const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);

  useEffect(() => {
    if (!chatWindowRef.current) return;
    chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
  }, [messages]);

  const handlePickReaction = (messageId: string, emoji: string) => {
    handleReact(messageId, emoji);
    setOpenPickerFor(null);
  };

  return (
    <div className="chatWindow" ref={chatWindowRef}>
      <div className="chatScroller">
        {messages.map((message) => {
          if ("meta" in message) {
            if (message.meta === "move") {
              return (
                <div key={message.messageId} className="chatMoveLog">
                  <UserLink user={message.user} />
                  {message.moveDescription}
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

          const messageReactions = reactions[message.messageId] ?? [];

          return (
            <div
              key={message.messageId}
              className={user.username === message.createdBy.username ? "chatMe" : "chatOther"}
            >
              <div className="chatSender">
                {user.username !== message.createdBy.username && (
                  <UserLink user={message.createdBy} />
                )}{" "}
                {timeSince(message.createdAt)}
              </div>
              <div className="chatContent">{message.text}</div>

              {messageReactions.length > 0 && (
                <div className="chatReactions">
                  {messageReactions.map((r) => (
                    <span key={r.username} className="chatReactionBubble">
                      {r.emoji} {r.username}
                    </span>
                  ))}
                </div>
              )}

              <div className="chatReactRow">
                <button
                  className="chatReactBtn"
                  onClick={() =>
                    setOpenPickerFor((prev) =>
                      prev === message.messageId ? null : message.messageId,
                    )
                  }
                >
                  😊
                </button>
                {openPickerFor === message.messageId && (
                  <div className="chatReactPicker">
                    {REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        className="chatReactOption"
                        onClick={() => handlePickReaction(message.messageId, emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
