import { describe, expect, it } from "vitest";
import { macHelperDownloadNote, offerMacHelperDownload, stagingWebOrigin } from "../staging-helper.js";

describe("staging helper download", () => {
  it("offers the Mac app on the staging site only", () => {
    expect(offerMacHelperDownload(stagingWebOrigin)).toBe(true);
    expect(offerMacHelperDownload("http://127.0.0.1:5173")).toBe(false);
    expect(offerMacHelperDownload("http://localhost:5173")).toBe(false);
    expect(macHelperDownloadNote).toBe(
      "Download the app, open it, allow folder access, then come back and click Connect this computer.",
    );
  });
});
