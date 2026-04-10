/* eslint-disable */

import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadKeyvModule() {
  vi.resetModules();
  return import("../src/keyv.ts");
}

describe("keyv.ts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("add + get works", async () => {
    const { createRepo } = await loadKeyvModule();

    const repo = createRepo<string>("test1");
    const key = await repo.add("hello");
    const value = await repo.get(key);

    expect(value).toBe("hello");
  });

  it("set failure throws error", async () => {
    const { createRepo, setDbInitializer } = await loadKeyvModule();

    setDbInitializer(
      () =>
        ({
          set: async () => false,
          get: async () => "x",
        }) as any,
    );

    const repo = createRepo<string>("test2");

    await expect(repo.set("k", "v")).rejects.toThrow("Failed to set key");
  });

  it("add failure throws error", async () => {
    const { createRepo, setDbInitializer } = await loadKeyvModule();

    setDbInitializer(
      () =>
        ({
          set: async () => false,
          get: async () => "x",
        }) as any,
    );

    const repo = createRepo<string>("test3");

    await expect(repo.add("x")).rejects.toThrow("Failed to set new key");
  });

  it("get missing key throws error", async () => {
    const { createRepo } = await loadKeyvModule();

    const repo = createRepo<string>("test4");

    await expect(repo.get("nope")).rejects.toThrow("Failed to find key");
  });

  it("find returns null if not found", async () => {
    const { createRepo } = await loadKeyvModule();

    const repo = createRepo<string>("test5");
    const result = await repo.find("missing");

    expect(result).toBeNull();
  });

  it("getMany throws when undefined exists", async () => {
    const { createRepo, setDbInitializer } = await loadKeyvModule();

    setDbInitializer(
      () =>
        ({
          getMany: async () => ["ok", undefined],
        }) as any,
    );

    const repo = createRepo<string>("test6");

    await expect(repo.getMany(["a", "b"])).rejects.toThrow("undefined keys");
  });

  it("getAllKeys works", async () => {
    const { createRepo, setDbInitializer } = await loadKeyvModule();

    const fakeIterator = async function* () {
      yield ["a"];
      yield ["b"];
    };

    setDbInitializer(
      () =>
        ({
          iterator: fakeIterator,
        }) as any,
    );

    const repo = createRepo<string>("test7");
    const keys = await repo.getAllKeys();

    expect(keys).toEqual(["a", "b"]);
  });

  it("clear does nothing if store not initialized", async () => {
    const { createRepo } = await loadKeyvModule();

    const repo = createRepo<string>("test8");

    await expect(repo.clear()).resolves.toBeUndefined();
  });

  it("remove works", async () => {
    const { createRepo, setDbInitializer } = await loadKeyvModule();

    const mockDelete = vi.fn();

    setDbInitializer(
      () =>
        ({
          delete: mockDelete,
        }) as any,
    );

    const repo = createRepo<string>("test9");
    await repo.remove("key");

    expect(mockDelete).toHaveBeenCalledWith("key");
  });

  it("setDbInitializer cannot be called twice", async () => {
    const { setDbInitializer } = await loadKeyvModule();

    setDbInitializer(() => ({}) as any);

    expect(() => {
      setDbInitializer(() => ({}) as any);
    }).toThrow("Database initializer cannot be set a second time");
  });
});
