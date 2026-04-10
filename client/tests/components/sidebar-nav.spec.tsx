import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { InviteContext } from "../../src/contexts/InviteContext.ts";

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}));

vi.mock("../../src/hooks/useAuth.ts", () => ({
  default: mockUseAuth,
}));

import SideBarNav from "../../src/components/SideBarNav.tsx";

function renderNav(pendingCount: number) {
  return render(
    <MemoryRouter>
      <InviteContext.Provider
        value={{
          invites: [],
          pendingCount,
          refreshInvites: async () => {},
          removeInvite: () => {},
        }}
      >
        <SideBarNav />
      </InviteContext.Provider>
    </MemoryRouter>,
  );
}

describe("SideBarNav invite badge", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue({ username: "user1", password: "pwd1111" });
  });

  it("shows the invite badge with the count when there are pending invites", () => {
    renderNav(3);
    expect(screen.getByText("3")).not.toBeNull();
  });

  it("shows a badge of 1 for a single pending invite", () => {
    renderNav(1);
    expect(screen.getByText("1")).not.toBeNull();
  });

  it("does not render an invite badge when there are no pending invites", () => {
    renderNav(0);
    // The badge element should not appear at all
    expect(screen.queryByText("0")).toBeNull();
  });
});
