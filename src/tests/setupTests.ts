import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, expect } from "vitest";
import { cleanup } from "@testing-library/react";
import { webcrypto } from "node:crypto";
import { server, setRequestErrorLogging } from "./server";

// Web Crypto pour les modules Edge-safe (ex. sharedAuth) sous Vitest/Node
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}

beforeAll(() => {
  setRequestErrorLogging(true);
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
  cleanup();
});

afterAll(() => {
  server.close();
});

expect.extend({});








