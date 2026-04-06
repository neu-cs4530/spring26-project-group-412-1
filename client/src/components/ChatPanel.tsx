import "./ChatPanel.css";
import MessageCreation from "./MessageCreation.tsx";
import MessageList from "./MessageList.tsx";
import useSocketsForChat from "../hooks/useSocketsForChat.ts";
import { getProfilePhotoSrc } from "../util/profilePhoto.ts";

interface ChatProps {
  chatId: string;
}

/**
 * A chat panel allows viewing and updating messages in live chat
 */
export default function ChatPanel({ chatId }: ChatProps) {
  const { messages, handleMessageCreation, handleToggleReaction, activeReactionBursts } =
    useSocketsForChat(chatId);
  return (
    messages && (
      <div className="chatContainer">
        {activeReactionBursts.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              flexWrap: "wrap",
              padding: "0.75rem 1rem 0",
            }}
          >
            {activeReactionBursts.map((burst) => (
              <div
                key={burst.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.35rem 0.6rem",
                  borderRadius: "999px",
                  backgroundColor: "oklch(0.96 0.03 75)",
                  border: "1px solid oklch(0.88 0.04 75)",
                }}
              >
                <img
                  src={getProfilePhotoSrc(burst.user.profilePhoto)}
                  alt={`${burst.user.display}'s profile`}
                  style={{
                    width: "2rem",
                    height: "2rem",
                    objectFit: "cover",
                    borderRadius: "50%",
                    border: "1px solid oklch(0.82 0 0)",
                  }}
                />
                <strong>{burst.user.display}</strong>
                <span style={{ fontSize: "1.25rem", lineHeight: 1 }}>{burst.emoji}</span>
              </div>
            ))}
          </div>
        )}
        <MessageList messages={messages} handleToggleReaction={handleToggleReaction} />
        <MessageCreation handleMessageCreation={handleMessageCreation} />
      </div>
    )
  );
}
