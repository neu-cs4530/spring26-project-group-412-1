import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SafeUserInfo, UserAuth } from "@gamenite/shared";
import { defaultProfilePhoto } from "@gamenite/shared";

const {
  mockUseLoginContext,
  mockUseAuth,
  mockUpdateUser,
  mockUploadUserProfilePhoto,
} = vi.hoisted(() => ({
  mockUseLoginContext: vi.fn(),
  mockUseAuth: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockUploadUserProfilePhoto: vi.fn(),
}));

vi.mock("../../src/hooks/useLoginContext.ts", () => ({
  default: mockUseLoginContext,
}));

vi.mock("../../src/hooks/useAuth.ts", () => ({
  default: mockUseAuth,
}));

vi.mock("../../src/hooks/useTimeSince.ts", () => ({
  default: () => () => "just now",
}));

vi.mock("../../src/services/userService.ts", () => ({
  updateUser: mockUpdateUser,
  uploadUserProfilePhoto: mockUploadUserProfilePhoto,
}));

import UpdateProfile from "../../src/pages/UpdateProfile.tsx";

const auth: UserAuth = { username: "user1", password: "pwd1111" };

const baseUser: SafeUserInfo = {
  username: "user1",
  display: "User One",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  profilePhoto: defaultProfilePhoto,
};

describe("UpdateProfile", () => {
  beforeEach(() => {
    mockUseLoginContext.mockReset();
    mockUseAuth.mockReset();
    mockUpdateUser.mockReset();
    mockUploadUserProfilePhoto.mockReset();

    mockUseLoginContext.mockReturnValue({
      user: { ...baseUser },
      pass: auth.password,
      reset: vi.fn(),
      setUser: vi.fn(),
      socket: {},
    });
    mockUseAuth.mockReturnValue(auth);

    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview-photo");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows a no-op error instead of submitting when the user has not changed anything", async () => {
    render(<UpdateProfile />);

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("No changes to submit")).not.toBeNull();
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(mockUploadUserProfilePhoto).not.toHaveBeenCalled();
  });

  it("shows pending photo preview state and clears it when requested", async () => {
    const { container } = render(<UpdateProfile />);
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();

    const selectedFile = new File(["png"], "avatar.png", { type: "image/png" });
    fireEvent.change(fileInput!, {
      target: { files: [selectedFile] },
    });

    expect(await screen.findByText("Previewing selected photo")).not.toBeNull();
    expect(screen.getByText("Selected: avatar.png")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));

    await waitFor(() => {
      expect(screen.getByText("Current saved photo")).not.toBeNull();
    });
    expect(screen.queryByText("Selected: avatar.png")).toBeNull();
  });

  it("lets the user switch to the default photo preview before submitting", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        blob: async () => new Blob(["png"], { type: "image/png" }),
      }),
    );

    render(<UpdateProfile />);

    fireEvent.click(screen.getByRole("button", { name: "Use default photo" }));

    expect(await screen.findByText("Previewing selected photo")).not.toBeNull();
    expect(screen.getByText("Selected: default-profile.png")).not.toBeNull();
  });
});
