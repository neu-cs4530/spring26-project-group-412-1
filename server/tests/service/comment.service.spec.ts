/* eslint-disable */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCommentRepo = {
  get: vi.fn(),
  add: vi.fn(),
};

const mockPopulateSafeUserInfo = vi.fn();

vi.mock("../../src/repository.ts", () => ({
  CommentRepo: mockCommentRepo,
}));

vi.mock("../../src/services/user.service.ts", () => ({
  populateSafeUserInfo: mockPopulateSafeUserInfo,
}));

describe("comment.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("populateCommentInfo returns expanded comment with editedAt", async () => {
    mockCommentRepo.get.mockResolvedValue({
      text: "edited comment",
      createdAt: "2026-04-10T20:00:00.000Z",
      createdBy: "user-1",
      editedAt: "2026-04-10T21:00:00.000Z",
    });

    mockPopulateSafeUserInfo.mockResolvedValue({
      username: "alice",
      display: "Alice",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const { populateCommentInfo } = await import("../../src/services/comment.service.ts");

    const result = await populateCommentInfo("comment-1");

    expect(mockCommentRepo.get).toHaveBeenCalledWith("comment-1");
    expect(mockPopulateSafeUserInfo).toHaveBeenCalledWith("user-1");

    expect(result).toEqual({
      commentId: "comment-1",
      text: "edited comment",
      createdAt: new Date("2026-04-10T20:00:00.000Z"),
      createdBy: {
        username: "alice",
        display: "Alice",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      editedAt: new Date("2026-04-10T21:00:00.000Z"),
    });
  });

  it("populateCommentInfo returns undefined editedAt when comment was never edited", async () => {
    mockCommentRepo.get.mockResolvedValue({
      text: "original comment",
      createdAt: "2026-04-10T20:00:00.000Z",
      createdBy: "user-2",
      editedAt: undefined,
    });

    mockPopulateSafeUserInfo.mockResolvedValue({
      username: "bob",
      display: "Bob",
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    const { populateCommentInfo } = await import("../../src/services/comment.service.ts");

    const result = await populateCommentInfo("comment-2");

    expect(result).toEqual({
      commentId: "comment-2",
      text: "original comment",
      createdAt: new Date("2026-04-10T20:00:00.000Z"),
      createdBy: {
        username: "bob",
        display: "Bob",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
      editedAt: undefined,
    });
  });

  it("createComment stores the new comment and returns populated info", async () => {
    mockCommentRepo.add.mockResolvedValue("new-comment-id");
    mockCommentRepo.get.mockResolvedValue({
      text: "hello world",
      createdAt: "2026-04-10T22:00:00.000Z",
      createdBy: "user-3",
      editedAt: undefined,
    });

    mockPopulateSafeUserInfo.mockResolvedValue({
      username: "carol",
      display: "Carol",
      createdAt: new Date("2026-01-03T00:00:00.000Z"),
    });

    const { createComment } = await import("../../src/services/comment.service.ts");

    const user = {
      userId: "user-3",
      username: "carol",
      display: "Carol",
      passwordHash: "hash",
      createdAt: "2026-01-03T00:00:00.000Z",
    };

    const createdAt = new Date("2026-04-10T22:00:00.000Z");
    const result = await createComment(user as any, "hello world", createdAt);

    expect(mockCommentRepo.add).toHaveBeenCalledWith({
      text: "hello world",
      createdAt: createdAt.toISOString(),
      createdBy: "user-3",
    });

    expect(mockCommentRepo.get).toHaveBeenCalledWith("new-comment-id");

    expect(result).toEqual({
      commentId: "new-comment-id",
      text: "hello world",
      createdAt: new Date("2026-04-10T22:00:00.000Z"),
      createdBy: {
        username: "carol",
        display: "Carol",
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
      },
      editedAt: undefined,
    });
  });
});
