import { ulid } from "ulid";

export function createIdGenerator(): () => string {
  return () => ulid();
}

export default function last<T>(array: T[]): T | undefined {
  return array[array.length - 1];
}
