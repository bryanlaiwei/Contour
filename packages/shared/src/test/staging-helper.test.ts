import { describe, expect, it } from "vitest";
import { macHelperDownloadNote, macHelperInstallCommand, offerMacHelperDownload, stagingMacHelperDownloadUrl, stagingWebOrigin } from "../staging-helper.js";

describe("staging helper download", () => {
  it("offers the Mac app on the staging site only", () => {
    expect(offerMacHelperDownload(stagingWebOrigin)).toBe(true);
    expect(offerMacHelperDownload("http://127.0.0.1:5173")).toBe(false);
    expect(offerMacHelperDownload("http://localhost:5173")).toBe(false);
    expect(macHelperDownloadNote).toBe(
      "Paste this in Terminal. It downloads the app and opens it. Allow folder access, then come back and click Connect this computer.",
    );
    expect(macHelperInstallCommand).toContain(`curl -fsSL -o /tmp/Contour-Mac.zip ${stagingMacHelperDownloadUrl}`);
    expect(macHelperInstallCommand).toContain('open "$HOME/Applications/Contour.app"');
  });
});
