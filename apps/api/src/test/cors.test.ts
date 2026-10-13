import { describe, expect, it } from "vitest";
import { isAllowedWebOrigin } from "../cors.js";

const site = "https://contourmaps.vercel.app";

describe("web origin allow list", () => {
  it("allows the configured site and local Vite", () => {
    expect(isAllowedWebOrigin(site, site)).toBe(true);
    expect(isAllowedWebOrigin("http://127.0.0.1:5173", site)).toBe(true);
    expect(isAllowedWebOrigin("http://localhost:5173", site)).toBe(true);
    expect(isAllowedWebOrigin("http://127.0.0.1:5175", site)).toBe(true);
    expect(isAllowedWebOrigin("http://localhost:5175", site)).toBe(true);
  });

  it("allows this project's Vercel preview hosts", () => {
    expect(
      isAllowedWebOrigin(
        "https://contour-git-mac-helper-contourmaps-bwei2398-5560s-projects.vercel.app",
        site,
      ),
    ).toBe(true);
    expect(
      isAllowedWebOrigin(
        "https://contour-hm153j5ch-bwei2398-5560s-projects.vercel.app",
        site,
      ),
    ).toBe(true);
  });

  it("rejects other sites", () => {
    expect(isAllowedWebOrigin("https://evil.example", site)).toBe(false);
    expect(isAllowedWebOrigin("https://contour-evil.vercel.app", site)).toBe(false);
    expect(isAllowedWebOrigin("https://other-app-bwei2398-5560s-projects.vercel.app", site)).toBe(false);
    expect(isAllowedWebOrigin("https://automatic-project-map-staging-o0bq87r4t-bwei2398-5560s-projects.vercel.app", site)).toBe(false);
    expect(
      isAllowedWebOrigin(
        "http://contour-abc-bwei2398-5560s-projects.vercel.app",
        site,
      ),
    ).toBe(false);
    expect(isAllowedWebOrigin("not a url", site)).toBe(false);
  });
});
