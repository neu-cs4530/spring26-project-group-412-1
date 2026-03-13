import type { BoardSpace, MonopolyPlayer, SafeUserInfo } from "@gamenite/shared";

interface MonopolyBoardProps {
  board: BoardSpace[];
  players: MonopolyPlayer[];
  userInfos: SafeUserInfo[];
  currentPlayerIndex: number;
}

function getOwnerLabel(space: BoardSpace, players: MonopolyPlayer[], userInfos: SafeUserInfo[]) {
  if (!("ownerId" in space) || !space.ownerId) {
    return undefined;
  }

  const ownerIndex = players.findIndex((player) => player.userId === space.ownerId);
  if (ownerIndex >= 0) {
    return userInfos[ownerIndex]?.display ?? players[ownerIndex]?.username ?? `P${ownerIndex + 1}`;
  }

  return space.ownerId;
}

function SpaceTile({
  space,
  playersHere,
  players,
  userInfos,
  currentPlayerIndex,
}: {
  space: BoardSpace;
  playersHere: Array<{ player: MonopolyPlayer; index: number }>;
  players: MonopolyPlayer[];
  userInfos: SafeUserInfo[];
  currentPlayerIndex: number;
}) {
  const color = space.type === "property" ? space.colorGroup : undefined;
  const ownerLabel = getOwnerLabel(space, players, userInfos);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        border: "1px solid black",
        backgroundColor: "white",
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
            fontWeight: 700,
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

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.2rem",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "1.5rem",
          }}
        >
          {playersHere.map(({ index }) => (
            <span
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
              {index + 1}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MonopolyBoard({
  board,
  players,
  userInfos,
  currentPlayerIndex,
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
          players={players}
          userInfos={userInfos}
          currentPlayerIndex={currentPlayerIndex}
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
          <div>Player chips show who is on each space.</div>
        </div>
      </div>

      <div>Chips are numbered by player order. Current turn is highlighted in blue.</div>
    </div>
  );
}
