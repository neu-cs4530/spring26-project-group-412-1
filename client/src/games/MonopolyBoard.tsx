import type { BoardSpace, MonopolyPlayer, SafeUserInfo } from "@gamenite/shared";
import React from "react";
import {
  Car,
  ChessKnight,
  Dices,
  Hotel,
  House,
  Ship,
  Dice1,
  Dice2,
  Dice3,
  Dice4,
  Dice5,
  Dice6,
  type LucideIcon,
} from "lucide-react";

interface MonopolyBoardProps {
  board: BoardSpace[];
  players: MonopolyPlayer[];
  userInfos: SafeUserInfo[];
  currentPlayerIndex: number;
  diceRoll?: [number, number];
  selectedSpaceId?: number;
  onSelectSpace?: (spaceId: number) => void;
}

const PLAYER_PIECES: LucideIcon[] = [Car, Ship, ChessKnight, Dices];

type BoardSpaceWithBuildings = BoardSpace & {
  houseCount?: number;
  hotelCount?: number;
  mortgaged?: boolean;
};

function getOwnerLabel(space: BoardSpace, userInfos: SafeUserInfo[]) {
  if (!("ownerIndex" in space) || space.ownerIndex === undefined) {
    return undefined;
  }

  return userInfos[space.ownerIndex]?.display ?? `P${space.ownerIndex + 1}`;
}

function getPlayerLabel(index: number, userInfos: SafeUserInfo[]) {
  return userInfos[index]?.display ?? `P${index + 1}`;
}

function SpaceTile({
  space,
  playersHere,
  userInfos,
  currentPlayerIndex,
  isSelected,
  onSelect,
}: {
  space: BoardSpace;
  playersHere: Array<{ player: MonopolyPlayer; index: number }>;
  userInfos: SafeUserInfo[];
  currentPlayerIndex: number;
  isSelected: boolean;
  onSelect?: () => void;
}) {
  const color = space.type === "property" ? space.colorGroup : undefined;
  const ownerLabel = getOwnerLabel(space, userInfos);
  const upgradedSpace = space as BoardSpaceWithBuildings;
  const houseCount = upgradedSpace.houseCount ?? 0;
  const hotelCount = upgradedSpace.hotelCount ?? 0;
  const mortgaged = upgradedSpace.mortgaged ?? false;
  const isOwnable =
    space.type === "property" || space.type === "railroad" || space.type === "utility";

  return (
    <div
      role={isOwnable ? "button" : undefined}
      tabIndex={isOwnable ? 0 : undefined}
      onClick={isOwnable ? onSelect : undefined}
      onKeyDown={
        isOwnable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect?.();
              }
            }
          : undefined
      }
      style={{
        width: "100%",
        height: "100%",
        border: isSelected ? "2px solid oklch(0.58 0.18 255)" : "1px solid black",
        backgroundColor: "white",
        cursor: isOwnable ? "pointer" : "default",
        boxShadow: isSelected ? "inset 0 0 0 1px white" : undefined,
      }}
    >
      {color && (
        <div
          style={{
            height: "10px",
            backgroundColor: color,
            borderBottom: "1px solid black",
          }}
        />
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: "0.2rem",
        }}
      >
        <div
          style={{
            fontSize: "0.5rem",
            fontWeight: 500,
            lineHeight: 1,
            textAlign: "center",
          }}
        >
          {space.name}
        </div>

        {"price" in space && (
          <div
            style={{
              fontSize: "0.5rem",
              textAlign: "center",
            }}
          >
            ${space.price}
          </div>
        )}

        {(houseCount > 0 || hotelCount > 0) && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.1rem",
              justifyContent: "center",
              alignItems: "center",
              minHeight: "0.9rem",
            }}
          >
            {Array.from({ length: houseCount }, (_, index) => (
              <House
                key={`house-${space.spaceId}-${index}`}
                size={11}
                color="green"
                strokeWidth={2.25}
              />
            ))}
            {Array.from({ length: hotelCount }, (_, index) => (
              <Hotel
                key={`hotel-${space.spaceId}-${index}`}
                size={11}
                color="red"
                strokeWidth={2.25}
              />
            ))}
          </div>
        )}

        {ownerLabel && (
          <div
            style={{
              fontSize: "0.5rem",
              textAlign: "center",
              color: "grey",
            }}
          >
            Owner: {ownerLabel}
          </div>
        )}

        {mortgaged && (
          <div
            style={{
              fontSize: "0.5rem",
              textAlign: "center",
              color: "firebrick",
              fontWeight: 700,
            }}
          >
            Mortgaged
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.2rem",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "1rem",
            maxWidth: "100%",
          }}
        >
          {playersHere.map(({ index }) => {
            const pieceIcon = PLAYER_PIECES[index % PLAYER_PIECES.length];
            const playerLabel = getPlayerLabel(index, userInfos);
            return (
              <span
                key={`${space.spaceId}-${index}`}
                aria-label={`Player token: ${playerLabel}`}
                title={playerLabel}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "1rem",
                  height: "1rem",
                  borderRadius: "999px",
                  backgroundColor: index === currentPlayerIndex ? "blue" : "grey",
                  color: "white",
                  fontSize: "0.5rem",
                  fontWeight: 700,
                }}
              >
                {React.createElement(pieceIcon, { size: 12, strokeWidth: 2.25 })}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DiceFace({ value }: { value: number }) {
  const diceIcons = {
    1: Dice1,
    2: Dice2,
    3: Dice3,
    4: Dice4,
    5: Dice5,
    6: Dice6,
  } as const;

  const diceIcon = diceIcons[value as keyof typeof diceIcons] ?? Dices;

  return (
    <div
      style={{
        width: "3rem",
        height: "3rem",
        border: "2px solid black",
        borderRadius: "0.75rem",
        backgroundColor: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {React.createElement(diceIcon, { size: 24, strokeWidth: 2.25 })}
    </div>
  );
}

export default function MonopolyBoard({
  board,
  players,
  userInfos,
  currentPlayerIndex,
  diceRoll,
  selectedSpaceId,
  onSelectSpace,
}: MonopolyBoardProps) {
  const boardById = new Map(board.map((space) => [space.spaceId, space]));
  const renderSpace = (spaceId: number, gridColumn: number, gridRow: number) => {
    const space = boardById.get(spaceId);

    if (!space) {
      return (
        <div
          key={`missing-${spaceId}`}
          style={{
            gridColumn,
            gridRow,
            border: "1px solid black",
            backgroundColor: "white",
          }}
        />
      );
    }

    const playersHere = players
      .map((player, index) => ({ player, index }))
      .filter(({ player }) => player.position === spaceId);

    return (
      <div
        key={spaceId}
        style={{
          gridColumn,
          gridRow,
          width: "100%",
          height: "100%",
          minWidth: 0,
          minHeight: 0,
        }}
      >
        <SpaceTile
          space={space}
          playersHere={playersHere}
          userInfos={userInfos}
          currentPlayerIndex={currentPlayerIndex}
          isSelected={selectedSpaceId === space.spaceId}
          onSelect={onSelectSpace ? () => onSelectSpace(space.spaceId) : undefined}
        />
      </div>
    );
  };

  return (
    <div className="spacedSection">
      <div
        style={{
          width: "100%",
          maxWidth: "900px",
          aspectRatio: "1 / 1",
          display: "grid",
          gridTemplateColumns: `repeat(11, 1fr)`,
          gridTemplateRows: `repeat(11, 1fr)`,
          border: "2px solid black",
          backgroundColor: "beige",
        }}
      >
        {Array.from({ length: 11 }, (_, i) => renderSpace(20 + i, i + 1, 1))}
        {Array.from({ length: 11 }, (_, i) => renderSpace(10 - i, i + 1, 11))}
        {Array.from({ length: 9 }, (_, i) => renderSpace(19 - i, 1, i + 2))}
        {Array.from({ length: 9 }, (_, i) => renderSpace(31 + i, 11, i + 2))}

        <div
          style={{
            gridColumn: "2 / 11",
            gridRow: "2 / 11",
            border: "2px solid black",
            background: "beige",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div style={{ fontSize: "2rem", fontWeight: 800 }}>MONOPOLY</div>
          <div>Board View</div>
          {diceRoll ? (
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                alignItems: "center",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <DiceFace value={diceRoll[0]} />
              <DiceFace value={diceRoll[1]} />
              <div style={{ fontWeight: 700 }}>Total: {diceRoll[0] + diceRoll[1]}</div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                gap: "0.4rem",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Dices size={18} strokeWidth={2.25} />
              <span>No dice roll yet</span>
            </div>
          )}
          <div>Player chips show who is on each space.</div>
        </div>
      </div>
    </div>
  );
}
