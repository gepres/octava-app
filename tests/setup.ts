import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { resetDBForTests } from "@/storage/db";

beforeEach(async () => {
  await resetDBForTests();
  // Base vacía y aislada para cada prueba.
  globalThis.indexedDB = new IDBFactory();
});

afterEach(() => {
  cleanup();
});
