import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MonopolyGameState, SafeUserInfo } from "@gamenite/shared";
import MonopolyGame from "../../src/games/MonopolyGame.tsx";

const PLAYERS: SafeUserInfo[] = [
  { username: "user1", display: "User One", createdAt: new Date("2026-01-01T00:00:00.000Z") },
  { username: "user2", display: "User Two", createdAt: new Date("2026-01-01T00:00:00.000Z") },
];

function makeView(): MonopolyGameState {
  return {
    players: [
      { money: 1500, position: 0, isBankrupt: false, inJail: false },
      { money: 1500, position: 0, isBankrupt: false, inJail: false },
    ],
    board: [
      { spaceId: 0, name: "Go", type: "go" },
      { spaceId: 1, name: "Mediterranean Avenue", type: "property", price: 60, rent: 2 },
      { spaceId: 4, name: "Income Tax", type: "tax", amount: 200 },
      { spaceId: 10, name: "Jail", type: "jail" },
    ],
    currentPlayerIndex: 0,
    phase: "playing",
    diceRoll: [2, 3],
    winnerIndex: undefined,
    chanceCursor: 0,
    communityChestCursor: 0,
    lastTurnEvents: [
      { type: "rolled", dice: [2, 3] },
      { type: "moved", from: 0, to: 4, destinationName: "Income Tax" },
      { type: "landed", spaceId: 4, spaceName: "Income Tax", spaceType: "tax" },
      { type: "paid_tax", amount: 200, spaceId: 4, spaceName: "Income Tax" },
    ],
  };
}

describe("MonopolyGame", () => {
  it("submits a roll move for the current player", () => {
    const makeMove = vi.fn();

    render(
      <MonopolyGame view={makeView()} players={PLAYERS} userPlayerIndex={0} makeMove={makeMove} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /roll dice/i }));
    expect(makeMove).toHaveBeenCalledWith({ type: "roll" });
  });

  it("disables rolling when it is not the user's turn", () => {
    const makeMove = vi.fn();
    const view = makeView();
    view.currentPlayerIndex = 1;

    render(<MonopolyGame view={view} players={PLAYERS} userPlayerIndex={0} makeMove={makeMove} />);

    expect(screen.getByRole("button", { name: /roll dice/i }).hasAttribute("disabled")).toBe(true);
  });

  it("renders the last-turn summary from Monopoly events", () => {
    render(
      <MonopolyGame view={makeView()} players={PLAYERS} userPlayerIndex={0} makeMove={vi.fn()} />,
    );

    expect(screen.getByText("Rolled 5")).not.toBeNull();
    expect(screen.getByText("Landed on Income Tax")).not.toBeNull();
    expect(screen.getByText("Paid $200 in tax")).not.toBeNull();
  });

  it("labels Chance and Community Chest cards in the turn summary", () => {
    const view = makeView();
    view.lastTurnEvents = [
      {
        type: "drew_card",
        deck: "chance",
        cardId: "chance-boardwalk",
        cardText: "Take a walk on the Boardwalk",
      },
      { type: "teleported", from: 7, to: 39, destinationName: "Boardwalk", reason: "chance" },
    ];

    render(<MonopolyGame view={view} players={PLAYERS} userPlayerIndex={0} makeMove={vi.fn()} />);

    expect(screen.getByText("Drew Chance: Take a walk on the Boardwalk")).not.toBeNull();
    expect(screen.getByText("Moved to Boardwalk")).not.toBeNull();
  });
});
