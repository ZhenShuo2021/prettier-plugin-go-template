import { createIdGenerator } from "./utils";
import last from "./utils";

describe("createIdGenerator", () => {
  it("should generate unique IDs on each call", () => {
    const idGenerator = createIdGenerator();
    const id1 = idGenerator();
    const id2 = idGenerator();

    expect(id1).not.toBe(id2);
  });

  it("should generate valid ULID-formatted strings", () => {
    const idGenerator = createIdGenerator();
    const id = idGenerator();

    // ULID format: 26 alphanumeric characters
    expect(typeof id).toBe("string");
    expect(id.length).toBe(26);
    // ULID uses base32 encoding: only characters 0-9, A-Z (no I, L, O, U)
    expect(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(id)).toBe(true);
  });

  it("should generate different IDs on subsequent calls", () => {
    const idGenerator = createIdGenerator();
    const ids = new Set([
      idGenerator(),
      idGenerator(),
      idGenerator(),
      idGenerator(),
      idGenerator(),
    ]);

    expect(ids.size).toBe(5);
  });
});

describe("last", () => {
  it("should return the last element of a non-empty array", () => {
    expect(last([1, 2, 3])).toBe(3);
  });

  it("should return undefined for an empty array", () => {
    expect(last([])).toBeUndefined();
  });

  it("should handle arrays with a single element", () => {
    expect(last([42])).toBe(42);
  });

  it("should work with different data types", () => {
    expect(last(["a", "b", "c"])).toBe("c");
    expect(last([{ id: 1 }, { id: 2 }])).toEqual({ id: 2 });
    expect(last([true, false, true])).toBe(true);
  });

  it("should not modify the original array", () => {
    const arr = [1, 2, 3];
    const result = last(arr);
    expect(arr).toEqual([1, 2, 3]);
    expect(result).toBe(3);
  });
});
