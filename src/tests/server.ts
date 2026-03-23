import { setupServer } from "msw/node";

export const server = setupServer();

export const setRequestErrorLogging = (enabled: boolean) => {
  server.events.removeAllListeners("request:unhandled");

  if (enabled) {
    server.events.on("request:unhandled", ({ request }) => {
      console.error(
        `Requête non gérée par MSW: ${request.method} ${request.url}`,
      );
    });
  }
};








