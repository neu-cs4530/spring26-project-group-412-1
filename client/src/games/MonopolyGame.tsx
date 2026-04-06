import { useEffect, useMemo, useState } from "react";
import type {
  MonopolyGameState,
  MonopolyMove,
  MonopolyTurnEvent,
  MonopolyTurnPhase,
  OwnableSpace,
  SafeUserInfo,
} from "@gamenite/shared";
import MonopolyBoard from "./MonopolyBoard";
import type { GameProps } from "../util/types.ts";
import MonopolyPropertyCard from "./MonopolyPropertyCard.tsx";

function playerLabel(players: SafeUserInfo[], playerIndex: number): string {
  return players[playerIndex]?.display ?? `P${playerIndex + 1}`;
}

function turnPhaseLabel(turnPhase: MonopolyTurnPhase): string {
  switch (turnPhase) {
    case "awaiting_roll":
      return "Roll";
    case "awaiting_purchase":
      return "Property decision";
    case "awaiting_end_turn":
      return "End turn";
  }
}

function mortgageValue(space: OwnableSpace) {
  return space.mortgageValue ?? Math.floor(space.price / 2);
}

function unmortgageCost(space: OwnableSpace) {
  return Math.ceil((mortgageValue(space) * 11) / 10);
}

function propertiesInColorGroup(view: MonopolyGameState, colorGroup: string) {
  return view.board.filter(
    (space): space is Extract<OwnableSpace, { type: "property" }> =>
      space.type === "property" && space.colorGroup === colorGroup,
  );
}

function ownsFullColorGroup(view: MonopolyGameState, playerIndex: number, colorGroup: string): boolean {
  const group = propertiesInColorGroup(view, colorGroup);
  return group.length > 0 && group.every((space) => space.ownerIndex === playerIndex);
}

function colorGroupHasMortgagedProperty(view: MonopolyGameState, colorGroup: string): boolean {
  return propertiesInColorGroup(view, colorGroup).some((space) => space.mortgaged);
}

function colorGroupHasBuildings(view: MonopolyGameState, colorGroup: string): boolean {
  return propertiesInColorGroup(view, colorGroup).some(
    (space) => (space.houseCount ?? 0) > 0 || (space.hotelCount ?? 0) > 0,
  );
}

function canBuildHouse(
  view: MonopolyGameState,
  playerIndex: number,
  space: OwnableSpace | undefined,
): space is Extract<OwnableSpace, { type: "property" }> {
  if (!space || space.type !== "property") return false;
  if (space.ownerIndex !== playerIndex || space.mortgaged) return false;
  if (!ownsFullColorGroup(view, playerIndex, space.colorGroup)) return false;
  if (colorGroupHasMortgagedProperty(view, space.colorGroup)) return false;
  if ((space.hotelCount ?? 0) > 0) return false;
  const group = propertiesInColorGroup(view, space.colorGroup);
  const minimumHouses = Math.min(...group.map((property) => property.houseCount ?? 0));
  return (space.houseCount ?? 0) < 4 && (space.houseCount ?? 0) === minimumHouses;
}

function canBuildHotel(
  view: MonopolyGameState,
  playerIndex: number,
  space: OwnableSpace | undefined,
): space is Extract<OwnableSpace, { type: "property" }> {
  if (!space || space.type !== "property") return false;
  if (space.ownerIndex !== playerIndex || space.mortgaged) return false;
  if (!ownsFullColorGroup(view, playerIndex, space.colorGroup)) return false;
  if (colorGroupHasMortgagedProperty(view, space.colorGroup)) return false;
  if ((space.hotelCount ?? 0) > 0 || (space.houseCount ?? 0) !== 4) return false;
  return propertiesInColorGroup(view, space.colorGroup).every(
    property =>
      property.spaceId === space.spaceId ||
      (property.hotelCount ?? 0) > 0 ||
      (property.houseCount ?? 0) === 4,
  );
}

function canMortgageSpace(
  view: MonopolyGameState,
  playerIndex: number,
  space: OwnableSpace | undefined,
): boolean {
  if (!space || space.ownerIndex !== playerIndex || space.mortgaged) return false;
  if (space.type === "property" && colorGroupHasBuildings(view, space.colorGroup)) return false;
  return true;
}

function describeEvent(event: MonopolyTurnEvent, players: SafeUserInfo[]): string {
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
    case "paid_money":
      return `Paid $${event.amount} for ${event.source}`;
    case "received_money":
      return `Received $${event.amount} from ${event.source}`;
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
    case "received_get_out_of_jail_card":
      return `Received a ${event.deck === "chance" ? "Chance" : "Community Chest"} Get Out of Jail Free card`;
    case "used_get_out_of_jail_card":
      return `Used a ${event.deck === "chance" ? "Chance" : "Community Chest"} Get Out of Jail Free card`;
    case "property_available":
      return `${event.spaceName} is available for $${event.price}`;
    case "property_purchased":
      return `Bought ${event.spaceName} for $${event.price}`;
    case "property_purchase_skipped":
      return `Passed on ${event.spaceName}`;
    case "paid_rent":
      return `Paid $${event.amount} rent on ${event.spaceName} to ${playerLabel(players, event.ownerIndex)}`;
    case "built_house":
      return `Built house #${event.houseCount} on ${event.spaceName} for $${event.amount}`;
    case "built_hotel":
      return `Built a hotel on ${event.spaceName} for $${event.amount}`;
    case "mortgaged_property":
      return `Mortgaged ${event.spaceName} for $${event.amount}`;
    case "unmortgaged_property":
      return `Unmortgaged ${event.spaceName} for $${event.amount}`;
    case "bankruptcy":
      return `${playerLabel(players, event.playerIndex)} went bankrupt from ${event.reason}`;
    case "won_game":
      return `${playerLabel(players, event.winnerIndex)} won the game`;
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
    view.pendingPropertyId ?? ownableSpaces[0]?.spaceId ?? null,
  );

  const isMyTurn = view.currentPlayerIndex === userPlayerIndex;
  const currentUserPlayer = userPlayerIndex >= 0 ? view.players[userPlayerIndex] : undefined;
  const isInJail = currentUserPlayer?.inJail ?? false;
  const lastRollTotal = view.diceRoll ? view.diceRoll[0] + view.diceRoll[1] : null;
  const controlsDisabled = !isMyTurn || view.phase !== "playing";
  const lastActionSummary = useMemo(
    () => view.lastTurnEvents.map((event) => describeEvent(event, players)),
    [players, view.lastTurnEvents],
  );
  const pendingProperty =
    view.pendingPropertyId !== undefined
      ? ownableSpaces.find((space) => space.spaceId === view.pendingPropertyId)
      : undefined;
  const selectedSpace =
    ownableSpaces.find((space) => space.spaceId === selectedSpaceId) ??
    pendingProperty ??
    ownableSpaces[0];
  const jailCardCount =
    (currentUserPlayer?.chanceGetOutOfJailFreeCards ?? 0) +
    (currentUserPlayer?.communityChestGetOutOfJailFreeCards ?? 0);
  const canUseJailCard = isInJail && jailCardCount > 0;
  const canBuyPending =
    pendingProperty !== undefined &&
    currentUserPlayer !== undefined &&
    currentUserPlayer.money >= pendingProperty.price;
  const canManageProperties =
    isMyTurn && view.phase === "playing" && view.turnPhase !== "awaiting_purchase";
  const selectedOwnedByMe = selectedSpace?.ownerIndex === userPlayerIndex;
  const canBuildSelectedHouse =
    userPlayerIndex >= 0 && canManageProperties && canBuildHouse(view, userPlayerIndex, selectedSpace);
  const canBuildSelectedHotel =
    userPlayerIndex >= 0 && canManageProperties && canBuildHotel(view, userPlayerIndex, selectedSpace);
  const canMortgageSelected =
    userPlayerIndex >= 0 && canManageProperties && canMortgageSpace(view, userPlayerIndex, selectedSpace);
  const canUnmortgageSelected =
    userPlayerIndex >= 0 &&
    canManageProperties &&
    selectedSpace?.ownerIndex === userPlayerIndex &&
    selectedSpace.mortgaged === true &&
    (currentUserPlayer?.money ?? 0) >= unmortgageCost(selectedSpace);
  const winnerLabel = view.winnerIndex !== undefined ? playerLabel(players, view.winnerIndex) : null;

  useEffect(() => {
    if (view.pendingPropertyId !== undefined) {
      setSelectedSpaceId(view.pendingPropertyId);
      return;
    }
    if (!selectedSpace && ownableSpaces[0]) {
      setSelectedSpaceId(ownableSpaces[0].spaceId);
    }
  }, [ownableSpaces, selectedSpace, view.pendingPropertyId]);

  return (
    <div className="content spacedSection">
      <h2>Monopoly</h2>
      <div>
        {view.phase === "finished" && winnerLabel ? (
          <strong>{winnerLabel} won the game.</strong>
        ) : isMyTurn ? (
          <strong>
            It&apos;s your turn. Current step: {turnPhaseLabel(view.turnPhase)}
            {view.extraTurn ? " (extra turn)" : ""}
          </strong>
        ) : (
          <span>
            Waiting for {playerLabel(players, view.currentPlayerIndex)}. Current step:{" "}
            {turnPhaseLabel(view.turnPhase)}
          </span>
        )}
      </div>

      <div>
        <h3>Players</h3>
        <ul>
          {view.players.map((player, index) => (
            <li key={index}>
              {index === userPlayerIndex ? "You" : playerLabel(players, index)} - ${player.money}
              {player.isBankrupt && " (bankrupt)"}
              {!player.isBankrupt && player.inJail && ` (in jail, turn ${player.jailTurns + 1} of 3)`}
              {index === view.currentPlayerIndex && view.phase === "playing" && " (current turn)"}
              {!player.isBankrupt &&
                (player.chanceGetOutOfJailFreeCards > 0 ||
                  player.communityChestGetOutOfJailFreeCards > 0) &&
                ` (${player.chanceGetOutOfJailFreeCards + player.communityChestGetOutOfJailFreeCards} jail card${player.chanceGetOutOfJailFreeCards + player.communityChestGetOutOfJailFreeCards === 1 ? "" : "s"})`}
            </li>
          ))}
        </ul>
      </div>

      {userPlayerIndex >= 0 && (
        <div className="spacedSection">
          {pendingProperty && isMyTurn && (
            <div>
              Choose whether to buy <strong>{pendingProperty.name}</strong> for $
              {pendingProperty.price}.
            </div>
          )}
          {isInJail && isMyTurn && view.turnPhase === "awaiting_roll" && (
            <div>
              You&apos;re in jail. Roll for doubles, pay $50 bail, or use a Get Out of Jail Free
              card if you have one.
            </div>
          )}
          {view.turnPhase === "awaiting_roll" && (
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                className="primary narrow"
                disabled={controlsDisabled}
                onClick={() => makeMove({ type: "roll" })}
              >
                {view.extraTurn ? "Roll Extra Turn" : isInJail ? "Roll For Doubles" : "Roll Dice"}
              </button>
              {isInJail && (
                <button
                  className="secondary narrow"
                  disabled={controlsDisabled}
                  onClick={() => makeMove({ type: "pay_bail" })}
                >
                  Pay $50 Bail
                </button>
              )}
              {canUseJailCard && (
                <button
                  className="secondary narrow"
                  disabled={controlsDisabled}
                  onClick={() => makeMove({ type: "use_get_out_of_jail_card" })}
                >
                  Use Jail Card
                </button>
              )}
            </div>
          )}
          {view.turnPhase === "awaiting_purchase" && pendingProperty && (
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                className="primary narrow"
                disabled={controlsDisabled || !canBuyPending}
                onClick={() => makeMove({ type: "buy_property" })}
              >
                Buy for ${pendingProperty.price}
              </button>
              <button
                className="secondary narrow"
                disabled={controlsDisabled}
                onClick={() => makeMove({ type: "pass_property" })}
              >
                Pass Property
              </button>
            </div>
          )}
          {view.turnPhase === "awaiting_end_turn" && view.phase === "playing" && (
            <button
              className="primary narrow"
              disabled={controlsDisabled}
              onClick={() => makeMove({ type: "end_turn" })}
            >
              End Turn
            </button>
          )}
          {canManageProperties && selectedSpace && selectedOwnedByMe && (
            <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.75rem" }}>
              <div>
                Managing <strong>{selectedSpace.name}</strong>
                {selectedSpace.mortgaged ? " (mortgaged)" : ""}
              </div>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                {selectedSpace.type === "property" && (
                  <button
                    className="secondary narrow"
                    disabled={!canBuildSelectedHouse}
                    onClick={() => makeMove({ type: "build_house", spaceId: selectedSpace.spaceId })}
                  >
                    Build House
                  </button>
                )}
                {selectedSpace.type === "property" && (
                  <button
                    className="secondary narrow"
                    disabled={!canBuildSelectedHotel}
                    onClick={() => makeMove({ type: "build_hotel", spaceId: selectedSpace.spaceId })}
                  >
                    Build Hotel
                  </button>
                )}
                <button
                  className="secondary narrow"
                  disabled={!canMortgageSelected}
                  onClick={() =>
                    makeMove({ type: "mortgage_property", spaceId: selectedSpace.spaceId })
                  }>
                  Mortgage
                </button>
                <button
                  className="secondary narrow"
                  disabled={!canUnmortgageSelected}
                  onClick={() =>
                    makeMove({ type: "unmortgage_property", spaceId: selectedSpace.spaceId })
                  }>
                  Unmortgage
                </button>
              </div>
            </div>
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
          <h3>{pendingProperty?.spaceId === selectedSpace.spaceId ? "Pending Property" : "Selected Property"}</h3>
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
                    ? `Owned by ${playerLabel(players, space.ownerIndex)}`
                    : "Available"}
                </span>
                {space.mortgaged && <span>Mortgaged</span>}
                {space.type === "property" && (
                  <span>
                    {space.hotelCount ? "1 hotel" : `${space.houseCount ?? 0} houses`}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
