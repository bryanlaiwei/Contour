import { describe, expect, it } from "vitest";
import { macHelperDownloadNote, macHelperDownloadUrl, macHelperInstallCommand, macHelperOpenCommand, macHelperSiteOrigin, offerMacHelperDownload } from "../mac-helper.js";

describe("Mac helper download", () => {
  it("offers the Mac app on the hosted site only", () => {
    expect(offerMacHelperDownload(macHelperSiteOrigin)).toBe(true);
    expect(offerMacHelperDownload("http://127.0.0.1:5173")).toBe(false);
    expect(offerMacHelperDownload("http://localhost:5173")).toBe(false);
    expect(macHelperDownloadNote).toBe(
      "Paste this in Terminal. It downloads the app and opens it. Allow folder access, then come back and click Connect this computer.",
    );
    expect(macHelperInstallCommand).toContain(`curl -fsSL -o /tmp/Contour-Mac.zip ${macHelperDownloadUrl}`);
    expect(macHelperOpenCommand).toBe('open "$HOME/Applications/Contour.app"');
    expect(macHelperInstallCommand.endsWith(macHelperOpenCommand)).toBe(true);
  });
});
