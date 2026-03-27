import { useMemo, useState } from "react";
import type {
  MonopolyGameState,
  MonopolyMove,
  MonopolyTurnEvent,
  OwnableSpace,
} from "@gamenite/shared";
import MonopolyBoard from "./MonopolyBoard";
import type { GameProps } from "../util/types.ts";

const REACTIONS = ["👍", "😄", "😮", "😢", "😡"];

function describeEvent(event: MonopolyTurnEvent): string {
  switch (event.type) {
    case "rolled":
      return `Rolled ${event.dice[0]} + ${event.dice[1]}`;
    case "moved":
      return `Moved to ${event.destinationName}`;
    case "landed":
      return `Landed on ${event.spaceName}`;
    case "passed_go":
      return `Collected $${event.amount} for passing Go`;
    case "paid_tax":
      return `Paid $${event.amount} in tax`;
    case "drew_card":
      return `Drew ${event.deck === "chance" ? "Chance" : "Community Chest"}: ${event.cardText}`;
    case "teleported":
      return `Moved to ${event.destinationName}`;
    case "sent_to_jail":
      return "Went to Jail";
  }
}

export default function MonopolyGame({
  view,
  players,
  userPlayerIndex,
  makeMove,
}: GameProps<MonopolyGameState, MonopolyMove>) {
  const [showDeck, setShowDeck] = useState(false);
  const [showReactPicker, setShowReactPicker] = useState(false);
  const [boardReactions, setBoardReactions] = useState<Record<number, string>>({});

  const ownableSpaces = view.board.filter(
    (space): space is OwnableSpace =>
      space.type === "property" || space.type === "railroad" || space.type === "utility",
  );

  const isMyTurn = view.currentPlayerIndex === userPlayerIndex;
  const lastRollTotal = view.diceRoll ? view.diceRoll[0] + view.diceRoll[1] : null;
  const lastActionSummary = useMemo(
    () => view.lastTurnEvents.map(describeEvent),
    [view.lastTurnEvents],
  );

  const handleBoardReact = (emoji: string) => {
    if (userPlayerIndex < 0) return;
    setBoardReactions((prev) => ({ ...prev, [userPlayerIndex]: emoji }));
    setShowReactPicker(false);

    setTimeout(() => {
      setBoardReactions((prev) => {
        const next = { ...prev };
        delete next[userPlayerIndex];
        return next;
      });
    }, 3000);
  };

  return (
    <div className="content spacedSection">
      <h2>Monopoly</h2>
      <div>
        {isMyTurn ? (
          <strong>It's your turn!</strong>
        ) : (
          <span>Waiting for {players[view.currentPlayerIndex]?.display}...</span>
        )}
      </div>
      <div>
        <h3>Players</h3>
        <ul>
          {view.players.map((player, index) => (
            <li key={index}>
              {index === userPlayerIndex ? "You" : players[index]?.display} - ${player.money}
              {player.inJail && " (in jail)"}
              {index === view.currentPlayerIndex && " (current turn)"}
            </li>
          ))}
        </ul>
      </div>
      {userPlayerIndex >= 0 && (
        <div>
          <button
            className="primary narrow"
            disabled={!isMyTurn || view.phase !== "playing"}
            onClick={() => makeMove({ type: "roll" })}
          >
            Roll Dice
          </button>
        </div>
      )}
      {view.diceRoll && (
        <div>
          Last roll: {view.diceRoll[0]} + {view.diceRoll[1]}
          {lastRollTotal !== null && ` = ${lastRollTotal}`}
        </div>
      )}
      {lastActionSummary.length > 0 && (
        <div className="spacedSection">
          <h3>Last Turn</h3>
          <ul>
            {lastActionSummary.map((summary) => (
              <li key={summary}>{summary}</li>
            ))}
          </ul>
        </div>
      )}

      {userPlayerIndex >= 0 && (
        <div style={{ position: "relative", display: "inline-block" }}>
          <button className="secondary narrow" onClick={() => setShowReactPicker((prev) => !prev)}>
            React 😊
          </button>
          {showReactPicker && (
            <div
              style={{
                position: "absolute",
                top: "2rem",
                left: 0,
                display: "flex",
                gap: "0.25rem",
                background: "white",
                border: "1px solid #ccc",
                borderRadius: "0.5rem",
                padding: "0.25rem",
                zIndex: 10,
              }}
            >
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleBoardReact(emoji)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "1.25rem",
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <MonopolyBoard
        board={view.board}
        players={view.players}
        userInfos={players}
        currentPlayerIndex={view.currentPlayerIndex}
        diceRoll={view.diceRoll}
        boardReactions={boardReactions}
      />
      <div>
        <button className="secondary narrow" onClick={() => setShowDeck((prev) => !prev)}>
          {showDeck ? "Hide Deck" : "Show Deck"}
        </button>
      </div>
      {showDeck && (
        <div className="spacedSection">
          <h3>Property Deck</h3>
          <div className="dottedList">
            {ownableSpaces.map((space) => (
              <div className="dottedListItem" key={space.spaceId}>
                <strong>{space.name}</strong> - ${space.price} (Rent: ${space.rent})
                {space.ownerIndex !== undefined
                  ? ` - Owned by ${players[space.ownerIndex]?.display ?? `P${space.ownerIndex + 1}`}`
                  : " - Available"}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
