/* eslint-disable */

import { describe, expect, it, vi } from "vitest";
import { logSocketError } from "../src/controllers/socket.controller.ts";

describe("logSocketError", () => {
  it("logs normal Error correctly", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const fakeSocket = {
      id: "socket-123",
    } as any;

    const err = new Error("something went wrong");

    logSocketError(fakeSocket, err);

    expect(consoleSpy).toHaveBeenCalledWith(
      'ERR! [socket-123] error message: "something went wrong"',
    );

    consoleSpy.mockRestore();
  });

  it("logs non-Error object correctly", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const fakeSocket = {
      id: "socket-456",
    } as any;

    const err = { foo: "bar" };

    logSocketError(fakeSocket, err);

    expect(consoleSpy).toHaveBeenCalledWith(
      `ERR! [socket-456] unexpected error ${JSON.stringify(err)}`,
    );

    consoleSpy.mockRestore();
  });

  it("logs primitive error correctly", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const fakeSocket = {
      id: "socket-789",
    } as any;

    const err = "simple string error";

    logSocketError(fakeSocket, err);

    expect(consoleSpy).toHaveBeenCalledWith(
      `ERR! [socket-789] unexpected error ${JSON.stringify(err)}`,
    );

    consoleSpy.mockRestore();
  });
});
