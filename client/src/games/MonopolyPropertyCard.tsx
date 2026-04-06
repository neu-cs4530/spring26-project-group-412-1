import type { OwnableSpace } from "@gamenite/shared";

function colorChip(colorGroup?: string) {
  if (!colorGroup) return null;
  return (
    <div
      style={{
        width: "100%",
        height: "0.8rem",
        borderRadius: "0.5rem",
        backgroundColor: colorGroup,
        border: "1px solid rgba(0, 0, 0, 0.15)",
      }}
    />
  );
}

export default function MonopolyPropertyCard({ space }: { space: OwnableSpace }) {
  return (
    <div
      style={{
        border: "1px solid oklch(0.8 0 0)",
        borderRadius: "0.9rem",
        padding: "1rem",
        backgroundColor: "white",
        display: "grid",
        gap: "0.75rem",
      }}
    >
      <div style={{ display: "grid", gap: "0.4rem" }}>
        {space.type === "property" ? colorChip(space.colorGroup) : null}
        <div style={{ fontSize: "0.8rem", textTransform: "uppercase", color: "oklch(0.45 0 0)" }}>
          {space.type === "property"
            ? `${space.colorGroup} property`
            : space.type === "railroad"
              ? "Railroad"
              : "Utility"}
        </div>
        <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{space.name}</div>
      </div>

      <div style={{ display: "grid", gap: "0.35rem", fontSize: "0.95rem" }}>
        <div>Purchase price: ${space.price}</div>
        <div>Mortgage value: ${space.mortgageValue ?? Math.floor(space.price / 2)}</div>
        {space.type === "property" && space.houseCost !== undefined ? (
          <div>House cost: ${space.houseCost} each</div>
        ) : null}
      </div>

      {space.type === "property" && space.rentSchedule ? (
        <div style={{ display: "grid", gap: "0.3rem" }}>
          <div style={{ fontWeight: 700 }}>Rent schedule</div>
          <div>Base rent: ${space.rentSchedule[0]}</div>
          <div>1 house: ${space.rentSchedule[1]}</div>
          <div>2 houses: ${space.rentSchedule[2]}</div>
          <div>3 houses: ${space.rentSchedule[3]}</div>
          <div>4 houses: ${space.rentSchedule[4]}</div>
          <div>Hotel: ${space.rentSchedule[5]}</div>
        </div>
      ) : null}

      {space.type === "railroad" && space.railroadRentSchedule ? (
        <div style={{ display: "grid", gap: "0.3rem" }}>
          <div style={{ fontWeight: 700 }}>Railroad rents</div>
          <div>1 railroad: ${space.railroadRentSchedule[0]}</div>
          <div>2 railroads: ${space.railroadRentSchedule[1]}</div>
          <div>3 railroads: ${space.railroadRentSchedule[2]}</div>
          <div>4 railroads: ${space.railroadRentSchedule[3]}</div>
        </div>
      ) : null}

      {space.type === "utility" && space.utilityMultiplierSchedule ? (
        <div style={{ display: "grid", gap: "0.3rem" }}>
          <div style={{ fontWeight: 700 }}>Utility rent</div>
          <div>1 utility: {space.utilityMultiplierSchedule[0]}x dice roll</div>
          <div>2 utilities: {space.utilityMultiplierSchedule[1]}x dice roll</div>
        </div>
      ) : null}
    </div>
  );
}
