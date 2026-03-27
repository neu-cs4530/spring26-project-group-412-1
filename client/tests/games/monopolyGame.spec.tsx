import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MonopolyGameState, SafeUserInfo } from "@gamenite/shared";
import MonopolyGame from "../../src/games/MonopolyGame.tsx";

const PLAYERS: SafeUserInfo[] = [
  { username: "user1", display: "User One", createdAt: new Date("2026-01-01T00:00:00.000Z") },
  { username: "user2", display: "User Two", createdAt: new Date("2026-01-01T00:00:00.000Z") },
  { username: "user3", display: "User Three", createdAt: new Date("2026-01-01T00:00:00.000Z") },
  { username: "user4", display: "User Four", createdAt: new Date("2026-01-01T00:00:00.000Z") },
];

function makeView(playerCount = 2): MonopolyGameState {
  return {
    players: PLAYERS.slice(0, playerCount).map(() => ({
      money: 1500,
      position: 0,
      isBankrupt: false,
      inJail: false,
      jailTurns: 0,
    })),
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

    expect(screen.getByText("Rolled 2 + 3")).not.toBeNull();
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

  it("offers pay-bail controls when the current player is in jail", () => {
    const makeMove = vi.fn();
    const view = makeView();
    view.players[0].inJail = true;
    view.players[0].jailTurns = 1;

    render(<MonopolyGame view={view} players={PLAYERS} userPlayerIndex={0} makeMove={makeMove} />);

    expect(
      screen.getByText("You're in jail. Roll for doubles or pay $50 bail to leave immediately."),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /pay \$50 bail/i }));
    expect(makeMove).toHaveBeenCalledWith({ type: "pay_bail" });
  });

  it("renders four-player labels and board tokens", () => {
    const view = makeView(4);

    render(<MonopolyGame view={view} players={PLAYERS} userPlayerIndex={0} makeMove={vi.fn()} />);

    expect(screen.getByText("User Two - $1500")).not.toBeNull();
    expect(screen.getByText("User Three - $1500")).not.toBeNull();
    expect(screen.getByText("User Four - $1500")).not.toBeNull();
    expect(screen.getByLabelText("Player token: User One")).not.toBeNull();
    expect(screen.getByLabelText("Player token: User Two")).not.toBeNull();
    expect(screen.getByLabelText("Player token: User Three")).not.toBeNull();
    expect(screen.getByLabelText("Player token: User Four")).not.toBeNull();
  });
});
