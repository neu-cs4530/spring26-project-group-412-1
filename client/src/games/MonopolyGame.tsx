import { useEffect, useMemo, useState } from "react";
import type {
  MonopolyGameState,
  MonopolyMove,
  MonopolyTurnEvent,
  OwnableSpace,
} from "@gamenite/shared";
import MonopolyBoard from "./MonopolyBoard";
import type { GameProps } from "../util/types.ts";
import MonopolyPropertyCard from "./MonopolyPropertyCard.tsx";

function describeEvent(event: MonopolyTurnEvent): string {
  switch (event.type) {
    case "rolled":
      return `Rolled ${event.dice[0] + event.dice[1]}`;
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
    case "stayed_in_jail":
      return `Stayed in Jail (${event.turnsRemaining} turns remaining)`;
    case "paid_bail":
      return event.automatic
        ? `Paid $${event.amount} automatic bail`
        : `Paid $${event.amount} bail`;
    case "left_jail":
      switch (event.method) {
        case "rolled_doubles":
          return "Left Jail by rolling doubles";
        case "paid_bail":
          return "Left Jail";
        case "automatic_bail":
          return "Left Jail after automatic bail";
      }
  }
}

export default function MonopolyGame({
  view,
  players,
  userPlayerIndex,
  makeMove,
}: GameProps<MonopolyGameState, MonopolyMove>) {
  const [showDeck, setShowDeck] = useState(false);

  const ownableSpaces = view.board.filter(
    (space): space is OwnableSpace =>
      space.type === "property" || space.type === "railroad" || space.type === "utility",
  );
  const [selectedSpaceId, setSelectedSpaceId] = useState<number | null>(
    ownableSpaces[0]?.spaceId ?? null,
  );

  const isMyTurn = view.currentPlayerIndex === userPlayerIndex;
  const currentUserPlayer = userPlayerIndex >= 0 ? view.players[userPlayerIndex] : undefined;
  const isInJail = currentUserPlayer?.inJail ?? false;
  const lastRollTotal = view.diceRoll ? view.diceRoll[0] + view.diceRoll[1] : null;
  const lastActionSummary = useMemo(
    () => view.lastTurnEvents.map(describeEvent),
    [view.lastTurnEvents],
  );
  const selectedSpace = ownableSpaces.find((space) => space.spaceId === selectedSpaceId) ?? ownableSpaces[0];

  useEffect(() => {
    if (!selectedSpace && ownableSpaces[0]) {
      setSelectedSpaceId(ownableSpaces[0].spaceId);
    }
  }, [ownableSpaces, selectedSpace]);

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
              {player.inJail && ` (in jail, turn ${player.jailTurns + 1} of 3)`}
              {index === view.currentPlayerIndex && " (current turn)"}
            </li>
          ))}
        </ul>
      </div>
      {userPlayerIndex >= 0 && (
        <div>
          {isInJail && isMyTurn && (
            <div>You're in jail. Roll for doubles or pay $50 bail to leave immediately.</div>
          )}
          <button
            className="primary narrow"
            disabled={!isMyTurn || view.phase !== "playing"}
            onClick={() => makeMove({ type: "roll" })}
          >
            {isInJail ? "Roll For Doubles" : "Roll Dice"}
          </button>
          {isInJail && (
            <button
              className="secondary narrow"
              disabled={!isMyTurn || view.phase !== "playing"}
              onClick={() => makeMove({ type: "pay_bail" })}
            >
              Pay $50 Bail
            </button>
          )}
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
            {lastActionSummary.map((summary, index) => (
              <li key={`${summary}-${index}`}>{summary}</li>
            ))}
          </ul>
        </div>
      )}

      <MonopolyBoard
        board={view.board}
        players={view.players}
        userInfos={players}
        currentPlayerIndex={view.currentPlayerIndex}
        diceRoll={view.diceRoll}
        selectedSpaceId={selectedSpace?.spaceId}
        onSelectSpace={(spaceId) => setSelectedSpaceId(spaceId)}
      />
      {selectedSpace && (
        <div className="spacedSection">
          <h3>Selected Property</h3>
          <MonopolyPropertyCard space={selectedSpace} />
        </div>
      )}
      <div>
        <button className="secondary narrow" onClick={() => setShowDeck((prev) => !prev)}>
          {showDeck ? "Hide Deck" : "Show Deck"}
        </button>
      </div>
      {showDeck && (
        <div className="spacedSection">
          <h3>Property Deck</h3>
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))",
            }}
          >
            {ownableSpaces.map((space) => (
              <button
                key={space.spaceId}
                type="button"
                onClick={() => setSelectedSpaceId(space.spaceId)}
                style={{
                  textAlign: "left",
                  border:
                    selectedSpace?.spaceId === space.spaceId
                      ? "2px solid oklch(0.58 0.18 255)"
                      : "1px solid oklch(0.82 0 0)",
                  borderRadius: "0.9rem",
                  backgroundColor: "white",
                  padding: "0.8rem",
                  display: "grid",
                  gap: "0.35rem",
                }}
              >
                <strong>{space.name}</strong>
                <span>${space.price}</span>
                <span>
                  {space.ownerIndex !== undefined
                    ? `Owned by ${players[space.ownerIndex]?.display ?? `P${space.ownerIndex + 1}`}`
                    : "Available"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
