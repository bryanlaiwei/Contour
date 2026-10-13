import { describe, expect, it } from "vitest";
import { isAllowedWebOrigin } from "../cors.js";

const staging = "https://automatic-project-map-staging.vercel.app";

describe("web origin allow list", () => {
  it("allows the configured site and local Vite", () => {
    expect(isAllowedWebOrigin(staging, staging)).toBe(true);
    expect(isAllowedWebOrigin("http://127.0.0.1:5173", staging)).toBe(true);
    expect(isAllowedWebOrigin("http://localhost:5173", staging)).toBe(true);
    expect(isAllowedWebOrigin("http://127.0.0.1:5175", staging)).toBe(true);
    expect(isAllowedWebOrigin("http://localhost:5175", staging)).toBe(true);
  });

  it("allows this project's Vercel preview hosts", () => {
    expect(
      isAllowedWebOrigin(
        "https://automatic-project-map-stagin-git-02ae82-bwei2398-5560s-projects.vercel.app",
        staging,
      ),
    ).toBe(true);
    expect(
      isAllowedWebOrigin(
        "https://automatic-project-map-staging-o0bq87r4t-bwei2398-5560s-projects.vercel.app",
        staging,
      ),
    ).toBe(true);
  });

  it("rejects other sites", () => {
    expect(isAllowedWebOrigin("https://evil.example", staging)).toBe(false);
    expect(isAllowedWebOrigin("https://automatic-project-map-evil.vercel.app", staging)).toBe(false);
    expect(isAllowedWebOrigin("https://other-app-bwei2398-5560s-projects.vercel.app", staging)).toBe(false);
    expect(
      isAllowedWebOrigin(
        "http://automatic-project-map-staging-abc-bwei2398-5560s-projects.vercel.app",
        staging,
      ),
    ).toBe(false);
    expect(isAllowedWebOrigin("not a url", staging)).toBe(false);
  });
});
