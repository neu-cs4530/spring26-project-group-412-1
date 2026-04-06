import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "../../src/util/types.ts";
import { defaultProfilePhoto } from "@gamenite/shared";

const { mockUseLoginContext } = vi.hoisted(() => ({
  mockUseLoginContext: vi.fn(),
}));

vi.mock("../../src/hooks/useLoginContext.ts", () => ({
  default: mockUseLoginContext,
}));

vi.mock("../../src/hooks/useTimeSince.ts", () => ({
  default: () => () => "just now",
}));

vi.mock("../../src/components/UserLink.tsx", () => ({
  default: ({ user }: { user: { display: string } }) => <span>{user.display}</span>,
}));

import MessageList from "../../src/components/MessageList.tsx";

const handleToggleReaction = vi.fn();

const otherUser = {
  username: "user2",
  display: "User Two",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  profilePhoto: defaultProfilePhoto,
};

function makeMessages(): ChatMessage[] {
  return [
    {
      messageId: "message-1",
      text: "Hello there",
      createdBy: otherUser,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      reactions: [
        {
          emoji: "👍",
          reactedBy: [otherUser],
        },
      ],
    },
    {
      messageId: "reaction-log-1",
      meta: "reaction",
      emoji: "😂",
      user: otherUser,
      dateTime: new Date("2026-01-01T00:00:10.000Z"),
    },
  ];
}

describe("MessageList reactions", () => {
  beforeEach(() => {
    handleToggleReaction.mockReset();
    mockUseLoginContext.mockReset();
    mockUseLoginContext.mockReturnValue({
      user: {
        username: "user1",
        display: "User One",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        profilePhoto: defaultProfilePhoto,
      },
    });
  });

  it("renders stored reaction history and lets the user choose a reaction", () => {
    render(<MessageList messages={makeMessages()} handleToggleReaction={handleToggleReaction} />);

    expect(
      screen.getByText(
        (_, element) => element?.textContent === "User Two reacted with 😂 just now",
      ),
    ).not.toBeNull();
    expect(screen.getByRole("button", { name: "👍 1" })).not.toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: "React" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "😡" }));

    expect(handleToggleReaction).toHaveBeenCalledExactlyOnceWith("message-1", "😡");
  });

  it("toggles an existing reaction when the badge is clicked", () => {
    render(<MessageList messages={makeMessages()} handleToggleReaction={handleToggleReaction} />);

    fireEvent.click(screen.getByRole("button", { name: "👍 1" }));

    expect(handleToggleReaction).toHaveBeenCalledExactlyOnceWith("message-1", "👍");
  });
});
