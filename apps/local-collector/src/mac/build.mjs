// Builds the menu-bar app: the current collector, a Node binary, and a Mac status item.
// The app accepts only the hosted website. npm run dev:helper is unchanged.

import { execFileSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, rmSync, chmodSync, cpSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = dirname(fileURLToPath(import.meta.url));
const cache = join(root, ".cache");
const nodeVersion = "v22.19.0";
const app = join(root, "build", "Contour.app");
const contents = join(app, "Contents");
const macos = join(contents, "MacOS");
const resources = join(contents, "Resources");
const collectorDir = join(resources, "collector");

const hostArch = process.arch === "arm64" ? "arm64" : "x64";
const archs = hostArch === "arm64" ? ["arm64", "x64"] : [hostArch];

rmSync(app, { recursive: true, force: true });
mkdirSync(macos, { recursive: true });
mkdirSync(collectorDir, { recursive: true });
mkdirSync(cache, { recursive: true });

await esbuild.build({
  entryPoints: [join(root, "main.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: join(collectorDir, "main.cjs"),
  external: ["better-sqlite3"],
});

const builtArchs = [];
for (const arch of archs) {
  try {
    const node = await nodeBinary(arch);
    const modules = await installSqlite(node, arch);
    builtArchs.push({ arch, node, modules });
  } catch (error) {
    if (arch === hostArch) {
      throw error;
    }
    console.warn(`Skipping ${arch}: ${error instanceof Error ? error.message : error}`);
  }
}

const packaged = [];
const menuBins = [];
for (const entry of builtArchs) {
  try {
    menuBins.push(compileMenu(entry.arch));
    packaged.push(entry);
  } catch (error) {
    if (entry.arch === hostArch) {
      throw error;
    }
    console.warn(`Skipping ${entry.arch} menu: ${error instanceof Error ? error.message : error}`);
  }
}
if (packaged.length === 0) {
  throw new Error("No architecture produced a menu.");
}
if (packaged.length === 1) {
  const only = packaged[0];
  cpSync(only.node, join(resources, "node"));
  cpSync(only.modules, join(collectorDir, "node_modules"), { recursive: true });
} else {
  execFileSync("lipo", ["-create", ...packaged.map((entry) => entry.node), "-output", join(resources, "node")]);
  const natives = packaged.map((entry) => findNative(entry.modules));
  cpSync(packaged[0].modules, join(collectorDir, "node_modules"), { recursive: true });
  execFileSync("lipo", ["-create", ...natives, "-output", findNative(join(collectorDir, "node_modules"))]);
}
chmodSync(join(resources, "node"), 0o755);
// npm leaves .bin links that point at the build cache. codesign rejects a bundle that contains them.
rmSync(join(collectorDir, "node_modules", ".bin"), { recursive: true, force: true });

const menuOut = join(macos, "Contour");
if (menuBins.length === 1) {
  cpSync(menuBins[0], menuOut);
} else {
  execFileSync("lipo", ["-create", ...menuBins, "-output", menuOut]);
}
chmodSync(menuOut, 0o755);

writeFileSync(join(contents, "Info.plist"), infoPlistText());

const identity = signingIdentity();
execFileSync("codesign", ["--force", "--deep", "--sign", identity, app], { stdio: "inherit" });

const zip = join(root, "build", "Contour-Mac.zip");
rmSync(zip, { force: true });
execFileSync("ditto", ["-c", "-k", "--keepParent", app, zip], { stdio: "inherit" });
console.log(`Built ${zip} (${packaged.map((entry) => entry.arch).join(", ")})`);

function infoPlistText() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleExecutable</key>
  <string>Contour</string>
  <key>CFBundleIconFile</key>
  <string></string>
  <key>CFBundleIdentifier</key>
  <string>app.contour.helper</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>Contour</string>
  <key>CFBundleDisplayName</key>
  <string>Contour</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSSupportsAutomaticTermination</key>
  <false/>
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsLocalNetworking</key>
    <true/>
  </dict>
</dict>
</plist>
`;
}

async function nodeBinary(arch) {
  const folder = join(cache, `node-${nodeVersion}-darwin-${arch}`);
  const binary = join(folder, "bin", "node");
  if (!existsSync(binary)) {
    const tar = join(cache, `node-${nodeVersion}-darwin-${arch}.tar.gz`);
    if (!existsSync(tar)) {
      const url = `https://nodejs.org/dist/${nodeVersion}/node-${nodeVersion}-darwin-${arch}.tar.gz`;
      console.log(`Downloading ${url}`);
      const response = await fetch(url);
      if (!response.ok || !response.body) {
        throw new Error(`Could not download Node ${arch} (${response.status}).`);
      }
      await pipeline(response.body, createWriteStream(tar));
    }
    execFileSync("tar", ["-xzf", tar, "-C", cache]);
  }
  return binary;
}

async function installSqlite(node, arch) {
  const dir = join(cache, `sqlite-${arch}`);
  if (existsSync(findNative(join(dir, "node_modules")))) {
    return join(dir, "node_modules");
  }
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "apm-mac-collector", private: true, dependencies: { "better-sqlite3": "12.4.1" } }),
  );
  const npm = join(dirname(node), "npm");
  execFileSync(npm, ["install", "--omit=dev", "--ignore-scripts=false"], {
    cwd: dir,
    env: {
      ...process.env,
      PATH: `${dirname(node)}:${process.env.PATH ?? ""}`,
      npm_config_workspaces: "false",
    },
    stdio: "inherit",
  });
  if (!existsSync(findNative(join(dir, "node_modules")))) {
    throw new Error(`better-sqlite3 did not build for ${arch}.`);
  }
  return join(dir, "node_modules");
}

function findNative(modules) {
  return join(modules, "better-sqlite3", "build", "Release", "better_sqlite3.node");
}

function compileMenu(arch) {
  const out = join(cache, `menu-${arch}`);
  execFileSync(
    "swiftc",
    [
      "-O",
      "-parse-as-library",
      "-target",
      `${arch === "x64" ? "x86_64" : arch}-apple-macos13.0`,
      "-framework",
      "AppKit",
      "-framework",
      "ServiceManagement",
      "-o",
      out,
      join(root, "MenuBar.swift"),
    ],
    { stdio: "inherit" },
  );
  return out;
}

function signingIdentity() {
  try {
    const listed = execFileSync("security", ["find-identity", "-v", "-p", "codesigning"], { encoding: "utf8" });
    const match = listed.match(/"((?:Developer ID Application|Apple Development)[^"]+)"/);
    if (match?.[1]) {
      return match[1];
    }
  } catch {
    // Ad-hoc signature still lets this Mac open a build that was not downloaded.
  }
  return "-";
}
