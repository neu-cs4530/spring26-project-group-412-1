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
      chanceGetOutOfJailFreeCards: 0,
      communityChestGetOutOfJailFreeCards: 0,
    })),
    board: [
      { spaceId: 0, name: "Go", type: "go" },
      {
        spaceId: 1,
        name: "Mediterranean Avenue",
        type: "property",
        price: 60,
        rent: 2,
        mortgaged: false,
        colorGroup: "brown",
        mortgageValue: 30,
        houseCost: 50,
        houseCount: 0,
        hotelCount: 0,
        rentSchedule: [2, 10, 30, 90, 160, 250],
      },
      {
        spaceId: 3,
        name: "Baltic Avenue",
        type: "property",
        price: 60,
        rent: 4,
        mortgaged: false,
        colorGroup: "brown",
        mortgageValue: 30,
        houseCost: 50,
        houseCount: 0,
        hotelCount: 0,
        rentSchedule: [4, 20, 60, 180, 320, 450],
      },
      { spaceId: 4, name: "Income Tax", type: "tax", amount: 200 },
      { spaceId: 10, name: "Jail", type: "jail" },
    ],
    currentPlayerIndex: 0,
    phase: "playing",
    turnPhase: "awaiting_roll",
    pendingPropertyId: undefined,
    extraTurn: false,
    consecutiveDoubles: 0,
    diceRoll: [2, 3],
    winnerIndex: undefined,
    chanceCursor: 0,
    communityChestCursor: 0,
    chanceGetOutOfJailFreeAvailable: true,
    communityChestGetOutOfJailFreeAvailable: true,
    lastTurnEvents: [
      { type: "rolled", dice: [2, 3] },
      { type: "moved", from: 0, to: 4, destinationName: "Income Tax" },
      { type: "landed", spaceId: 4, spaceName: "Income Tax", spaceType: "tax" },
      { type: "paid_tax", amount: 200, spaceId: 4, spaceName: "Income Tax" },
    ],
  };
}

describe("MonopolyGame", () => {
  it("submits a roll move for the current player during the roll phase", () => {
    const makeMove = vi.fn();

    render(
      <MonopolyGame view={makeView()} players={PLAYERS} userPlayerIndex={0} makeMove={makeMove} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /roll dice/i }));
    expect(makeMove).toHaveBeenCalledWith({ type: "roll" });
  });

  it("shows buy and pass actions when a property decision is pending", () => {
    const makeMove = vi.fn();
    const view = makeView();
    view.turnPhase = "awaiting_purchase";
    view.pendingPropertyId = 3;

    render(<MonopolyGame view={view} players={PLAYERS} userPlayerIndex={0} makeMove={makeMove} />);

    expect(screen.getByText(/choose whether to buy/i)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /buy for \$60/i }));
    fireEvent.click(screen.getByRole("button", { name: /pass property/i }));
    expect(makeMove).toHaveBeenNthCalledWith(1, { type: "buy_property" });
    expect(makeMove).toHaveBeenNthCalledWith(2, { type: "pass_property" });
    expect(screen.getByText("Pending Property")).not.toBeNull();
  });

  it("shows end-turn controls after a completed action phase", () => {
    const makeMove = vi.fn();
    const view = makeView();
    view.turnPhase = "awaiting_end_turn";
    view.lastTurnEvents = [
      {
        type: "property_purchased",
        spaceId: 3,
        spaceName: "Baltic Avenue",
        price: 60,
      },
    ];

    render(<MonopolyGame view={view} players={PLAYERS} userPlayerIndex={0} makeMove={makeMove} />);

    fireEvent.click(screen.getByRole("button", { name: /end turn/i }));
    expect(makeMove).toHaveBeenCalledWith({ type: "end_turn" });
    expect(screen.getByText("Bought Baltic Avenue for $60")).not.toBeNull();
  });

  it("shows house and mortgage management for the selected owned property", () => {
    const makeMove = vi.fn();
    const view = makeView();
    view.turnPhase = "awaiting_end_turn";
    view.board[0] = view.board[0];
    if (view.board[1]?.type === "property" && view.board[2]?.type === "property") {
      view.board[1].ownerIndex = 0;
      view.board[2].ownerIndex = 0;
    }

    render(<MonopolyGame view={view} players={PLAYERS} userPlayerIndex={0} makeMove={makeMove} />);

    fireEvent.click(screen.getByRole("button", { name: /build house/i }));
    fireEvent.click(screen.getByRole("button", { name: /^mortgage$/i }));
    expect(makeMove).toHaveBeenNthCalledWith(1, { type: "build_house", spaceId: 1 });
    expect(makeMove).toHaveBeenNthCalledWith(2, { type: "mortgage_property", spaceId: 1 });
  });

  it("shows unmortgage controls and mortgaged property details", () => {
    const makeMove = vi.fn();
    const view = makeView();
    view.turnPhase = "awaiting_end_turn";
    view.players[0].money = 500;
    if (view.board[1]?.type === "property") {
      view.board[1].ownerIndex = 0;
      view.board[1].mortgaged = true;
      view.board[1].houseCount = 2;
      view.board[1].hotelCount = 0;
    }

    render(<MonopolyGame view={view} players={PLAYERS} userPlayerIndex={0} makeMove={makeMove} />);

    expect(screen.getByText("Mortgage status: Mortgaged")).not.toBeNull();
    expect(screen.getByText("Unmortgage cost: $33")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /unmortgage/i }));
    expect(makeMove).toHaveBeenCalledWith({ type: "unmortgage_property", spaceId: 1 });
  });

  it("shows hotel management when the selected property already has four houses", () => {
    const makeMove = vi.fn();
    const view = makeView();
    view.turnPhase = "awaiting_end_turn";
    if (view.board[1]?.type === "property" && view.board[2]?.type === "property") {
      view.board[1].ownerIndex = 0;
      view.board[2].ownerIndex = 0;
      view.board[1].houseCount = 4;
      view.board[2].houseCount = 4;
    }

    render(<MonopolyGame view={view} players={PLAYERS} userPlayerIndex={0} makeMove={makeMove} />);

    fireEvent.click(screen.getByRole("button", { name: /build hotel/i }));
    expect(makeMove).toHaveBeenCalledWith({ type: "build_hotel", spaceId: 1 });
  });

  it("offers jail-card and bail controls while in jail", () => {
    const makeMove = vi.fn();
    const view = makeView();
    view.players[0].inJail = true;
    view.players[0].jailTurns = 1;
    view.players[0].chanceGetOutOfJailFreeCards = 1;

    render(<MonopolyGame view={view} players={PLAYERS} userPlayerIndex={0} makeMove={makeMove} />);

    expect(
      screen.getByText(/roll for doubles, pay \$50 bail, or use a get out of jail free card/i),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /pay \$50 bail/i }));
    fireEvent.click(screen.getByRole("button", { name: /use jail card/i }));
    expect(makeMove).toHaveBeenNthCalledWith(1, { type: "pay_bail" });
    expect(makeMove).toHaveBeenNthCalledWith(2, { type: "use_get_out_of_jail_card" });
  });

  it("renders full player status and rent summaries", () => {
    const view = makeView(4);
    view.players[1].chanceGetOutOfJailFreeCards = 1;
    view.lastTurnEvents = [
      {
        type: "paid_rent",
        amount: 25,
        spaceId: 5,
        spaceName: "Reading Railroad",
        ownerIndex: 1,
      },
    ];

    render(<MonopolyGame view={view} players={PLAYERS} userPlayerIndex={0} makeMove={vi.fn()} />);

    expect(screen.getByText("User Two - $1500 (1 jail card)")).not.toBeNull();
    expect(screen.getByText("User Three - $1500")).not.toBeNull();
    expect(screen.getByText("User Four - $1500")).not.toBeNull();
    expect(screen.getByText("Paid $25 rent on Reading Railroad to User Two")).not.toBeNull();
    expect(screen.getByLabelText("Player token: User One")).not.toBeNull();
    expect(screen.getByLabelText("Player token: User Four")).not.toBeNull();
  });

  it("shows the winner banner when the game is finished", () => {
    const view = makeView();
    view.phase = "finished";
    view.turnPhase = "awaiting_end_turn";
    view.winnerIndex = 1;
    view.lastTurnEvents = [{ type: "won_game", winnerIndex: 1 }];

    render(<MonopolyGame view={view} players={PLAYERS} userPlayerIndex={0} makeMove={vi.fn()} />);

    expect(screen.getByText("User Two won the game.")).not.toBeNull();
    expect(screen.getByText("User Two won the game")).not.toBeNull();
  });

  it("shows a property detail card with full rent values", () => {
    render(
      <MonopolyGame view={makeView()} players={PLAYERS} userPlayerIndex={0} makeMove={vi.fn()} />,
    );

    expect(screen.getByText("Selected Property")).not.toBeNull();
    expect(screen.getByText("Purchase price: $60")).not.toBeNull();
    expect(screen.getByText("Mortgage value: $30")).not.toBeNull();
    expect(screen.getByText("Mortgage status: Active")).not.toBeNull();
    expect(screen.getByText("Buildings: 0 houses")).not.toBeNull();
    expect(screen.getByText("House cost: $50 each")).not.toBeNull();
    expect(screen.getByText("Hotel: $250")).not.toBeNull();
  });
});
