import { useState } from "react";
import type { MonopolyGameState, OwnableSpace, SafeUserInfo } from "@gamenite/shared";
import MonopolyBoard from "./MonopolyBoard";
import { Dices } from "lucide-react";

interface MonopolyGameProps {
  view: MonopolyGameState;
  players: SafeUserInfo[];
  userPlayerIndex: number;
  makeMove: (move: unknown) => void;
}

export default function MonopolyGame({
  view,
  players,
  userPlayerIndex,
  makeMove,
}: MonopolyGameProps) {
  const [showDeck, setShowDeck] = useState(false);

  /** All ownable spaces (properties, railroads, utilities) from the board */
  const ownableSpaces = view.board.filter(
    (space): space is OwnableSpace =>
      space.type === "property" || space.type === "railroad" || space.type === "utility",
  );

  const isMyTurn = view.currentPlayerIndex === userPlayerIndex;

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
            <li key={player.userId}>
              {index === userPlayerIndex ? "You" : players[index]?.display} — ${player.money}
              {index === view.currentPlayerIndex && " (current turn)"}
            </li>
          ))}
        </ul>
      </div>

      {isMyTurn && (
        <div>
          <button className="primary narrow" onClick={() => makeMove({ type: "ROLL_DICE" })}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Dices size={16} strokeWidth={2.25} />
              Roll Dice
            </span>
          </button>
        </div>
      )}

      <MonopolyBoard
        board={view.board}
        players={view.players}
        userInfos={players}
        currentPlayerIndex={view.currentPlayerIndex}
        diceRoll={view.diceRoll}
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
                <strong>{space.name}</strong> — ${space.price} (Rent: ${space.rent})
                {space.ownerId ? ` — Owned by ${space.ownerId}` : " — Available"}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
