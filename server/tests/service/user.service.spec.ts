import { describe, expect, it } from "vitest";
import {
  createUser,
  updateUser,
  updateUserProfilePhoto,
  MAX_PROFILE_PHOTO_BYTES,
} from "../../src/services/user.service.ts";
import { enforceAuth } from "../../src/services/auth.service.ts";

// enforceAuth isn't tested by current integration tests,
// because existing tests exercise the REST api, and enforceAuth
// is only used in the socket api
describe("enforceAuth", () => {
  it("should return a user and id on good auth", async () => {
    const user = await enforceAuth({ username: "user1", password: "pwd1111" });
    expect(user).toStrictEqual({ userId: expect.any(String), username: "user1" });
  });

  it("should raise on bad auth", async () => {
    await expect(enforceAuth({ username: "user1", password: "no" })).rejects.toThrow();
  });
});

// updateUser can't be fully tested by current integration tests; part of its
// contract is that it throws if updateUser is called with an invalid user id,
// but a well-behaved controller won't ever invoke updateUser with an invalid
// user id
describe("updateUser", () => {
  it("should throw if given an invalid user id", async () => {
    await expect(updateUser("fake", { display: "Stacey Fakename" })).rejects.toThrow();
  });
});

describe("createUser - disallowed usernames", () => {
  it("rejects reserved usernames like 'login', 'signup', and 'list'", async () => {
    const result1 = await createUser("login", "password", new Date());
    expect(result1).toStrictEqual({ error: "That is not a permitted username" });

    const result2 = await createUser("signup", "password", new Date());
    expect(result2).toStrictEqual({ error: "That is not a permitted username" });

    const result3 = await createUser("list", "password", new Date());
    expect(result3).toStrictEqual({ error: "That is not a permitted username" });
  });
});

describe("updateUserProfilePhoto - validation edge cases", () => {
  const validPng = Buffer.from("89504E470D0A1A0A0000000D49484452", "hex");

  it("throws when the uploaded buffer is empty", async () => {
    await expect(
      updateUserProfilePhoto("user1", {
        buffer: Buffer.alloc(0),
        mimetype: "image/png",
        size: 0,
      }),
    ).rejects.toThrow("Profile photo is empty");
  });

  it("throws when the buffer size exceeds the maximum", async () => {
    const oversized = Buffer.alloc(MAX_PROFILE_PHOTO_BYTES + 1);
    validPng.copy(oversized);
    await expect(
      updateUserProfilePhoto("user1", {
        buffer: oversized,
        mimetype: "image/png",
        size: MAX_PROFILE_PHOTO_BYTES + 1,
      }),
    ).rejects.toThrow("Profile photo exceeds maximum size");
  });

  it("throws when the file claims to be an image but has wrong magic bytes", async () => {
    const fakePng = Buffer.from("this is not a real png file content at all", "utf8");
    await expect(
      updateUserProfilePhoto("user1", {
        buffer: fakePng,
        mimetype: "image/png",
        size: fakePng.length,
      }),
    ).rejects.toThrow("valid PNG, JPEG, or WEBP image");
  });
});
