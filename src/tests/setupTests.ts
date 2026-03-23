import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, expect } from "vitest";
import { cleanup } from "@testing-library/react";
import { server, setRequestErrorLogging } from "./server";

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








