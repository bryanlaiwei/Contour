// Menu bar for the staging helper. There is no window: the map stays on the website.
// Pause stops collection. Quit stops the process. The next login starts it again.

import AppKit
import Darwin
import Foundation
import ServiceManagement

private let stagingMap = URL(string: "https://automatic-project-map-staging.vercel.app")!
private let helperURL = URL(string: "http://127.0.0.1:47321")!
private let appSupportName = "Contour"
private let delegate = AppDelegate()

@main
enum Main {
  static func main() {
    let app = NSApplication.shared
    app.setActivationPolicy(.accessory)
    app.delegate = delegate
    app.run()
  }
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
  private var statusItem: NSStatusItem!
  private var collector: Process?
  private var collectorInput: Pipe?
  private var timer: Timer?
  private var lockFD: Int32 = -1
  private var quitting = false
  private var helperReachable = false
  private var connected = false
  private var collecting = true
  private var blocked: [String] = []
  private var startError: String?
  private var logTail = ""
  private let statusMenuItem = NSMenuItem(title: "Starting…", action: nil, keyEquivalent: "")
  private let allowItem = NSMenuItem(title: "Allow folder access", action: #selector(allowFolderAccess), keyEquivalent: "")
  private let pauseItem = NSMenuItem(title: "Pause", action: #selector(togglePause), keyEquivalent: "")
  private let openItem = NSMenuItem(title: "Open the map", action: #selector(openMap), keyEquivalent: "")
  private let loginItem = NSMenuItem(title: "Allow start at login", action: #selector(openLoginItems), keyEquivalent: "")
  private let quitItem = NSMenuItem(title: "Quit", action: #selector(quit), keyEquivalent: "q")

  func applicationDidFinishLaunching(_ notification: Notification) {
    statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
    statusMenuItem.isEnabled = false
    allowItem.target = self
    allowItem.isHidden = true
    pauseItem.target = self
    openItem.target = self
    loginItem.target = self
    loginItem.isHidden = true
    quitItem.target = self
    let menu = NSMenu()
    menu.delegate = self
    menu.addItem(statusMenuItem)
    menu.addItem(.separator())
    menu.addItem(allowItem)
    menu.addItem(pauseItem)
    menu.addItem(openItem)
    menu.addItem(loginItem)
    menu.addItem(.separator())
    menu.addItem(quitItem)
    statusItem.menu = menu
    updateIcon()

    if !acquireLock() {
      quitting = true
      NSApp.terminate(nil)
      return
    }
    if relocateIfNeeded() {
      return
    }
    touchLogFolders()
    registerLoginItem()
    startCollector()
    let timer = Timer.scheduledTimer(withTimeInterval: 3, repeats: true) { [weak self] _ in
      self?.refresh()
    }
    RunLoop.main.add(timer, forMode: .common)
    self.timer = timer
    refresh()
  }

  func applicationWillTerminate(_ notification: Notification) {
    quitting = true
    timer?.invalidate()
    stopCollector()
    releaseLock()
  }

  func menuWillOpen(_ menu: NSMenu) {
    refresh()
  }

  private func appSupportURL() -> URL {
    let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    return base.appendingPathComponent(appSupportName, isDirectory: true)
  }

  private func acquireLock() -> Bool {
    let support = appSupportURL()
    try? FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
    lockFD = open(support.appendingPathComponent("menu.lock").path, O_CREAT | O_RDWR, 0o644)
    if lockFD < 0 {
      return true
    }
    return flock(lockFD, LOCK_EX | LOCK_NB) == 0
  }

  private func releaseLock() {
    if lockFD >= 0 {
      flock(lockFD, LOCK_UN)
      close(lockFD)
      lockFD = -1
    }
  }

  /// Keeps the login item pointed at a stable copy. Returns true when this process is handing off.
  private func relocateIfNeeded() -> Bool {
    if ProcessInfo.processInfo.environment["APM_SKIP_RELOCATE"] == "1" {
      return false
    }
    let current = Bundle.main.bundleURL.standardizedFileURL
    let userApps = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Applications/Contour.app")
    let systemApps = URL(fileURLWithPath: "/Applications/Contour.app").standardizedFileURL
    if current == userApps.standardizedFileURL || current == systemApps {
      return false
    }
    do {
      try FileManager.default.createDirectory(at: userApps.deletingLastPathComponent(), withIntermediateDirectories: true)
      if FileManager.default.fileExists(atPath: userApps.path) {
        try FileManager.default.removeItem(at: userApps)
      }
      try FileManager.default.copyItem(at: Bundle.main.bundleURL, to: userApps)
    } catch {
      startError = "Could not install the app in Applications."
      updateMenu()
      return false
    }
    releaseLock()
    let config = NSWorkspace.OpenConfiguration()
    config.createsNewApplicationInstance = true
    NSWorkspace.shared.openApplication(at: userApps, configuration: config) { [weak self] _, error in
      DispatchQueue.main.async {
        guard let self else { return }
        if error != nil {
          _ = self.acquireLock()
          self.startError = "Could not open the installed app."
          self.touchLogFolders()
          self.registerLoginItem()
          self.startCollector()
          self.updateMenu()
          return
        }
        self.quitting = true
        NSApp.terminate(nil)
      }
    }
    return true
  }

  private func touchLogFolders() {
    let home = FileManager.default.homeDirectoryForCurrentUser
    for relative in [".codex/sessions", ".claude/projects", ".cursor"] {
      let url = home.appendingPathComponent(relative)
      _ = try? FileManager.default.contentsOfDirectory(at: url, includingPropertiesForKeys: nil)
    }
  }

  private func registerLoginItem() {
    if ProcessInfo.processInfo.environment["APM_SKIP_LOGIN_ITEM"] == "1" {
      return
    }
    let service = SMAppService.mainApp
    switch service.status {
    case .enabled:
      loginItem.isHidden = true
    case .requiresApproval:
      loginItem.isHidden = false
    case .notRegistered, .notFound:
      do {
        try service.register()
        loginItem.isHidden = service.status != .requiresApproval
      } catch {
        loginItem.title = "Could not start at login"
        loginItem.isHidden = false
      }
    @unknown default:
      loginItem.isHidden = true
    }
  }

  private func startCollector() {
    guard collector == nil || collector?.isRunning != true else { return }
    guard let resources = Bundle.main.resourceURL else {
      startError = "The app is missing its collector."
      updateMenu()
      return
    }
    let process = Process()
    process.executableURL = resources.appendingPathComponent("node")
    process.arguments = [resources.appendingPathComponent("collector/main.cjs").path, "serve"]
    process.currentDirectoryURL = appSupportURL()
    var environment = ProcessInfo.processInfo.environment
    environment["WEB_ORIGIN"] = stagingMap.absoluteString
    environment["APM_HELPER_STRICT_ORIGIN"] = "1"
    process.environment = environment
    let input = Pipe()
    collectorInput = input
    process.standardInput = input
    let pipe = Pipe()
    process.standardOutput = pipe
    process.standardError = pipe
    pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
      let data = handle.availableData
      guard !data.isEmpty, let text = String(data: data, encoding: .utf8) else { return }
      DispatchQueue.main.async {
        guard let self else { return }
        self.logTail = String((self.logTail + text).suffix(4000))
      }
    }
    process.terminationHandler = { [weak self] process in
      DispatchQueue.main.async {
        guard let self, !self.quitting else { return }
        self.collector = nil
        self.helperReachable = false
        let line = self.logTail.split(separator: "\n").last.map(String.init)
        self.startError = line ?? "The helper stopped (\(process.terminationStatus))."
        self.updateMenu()
      }
    }
    do {
      try process.run()
      collector = process
      startError = nil
    } catch {
      startError = "Could not start the helper."
    }
    updateMenu()
  }

  private func stopCollector() {
    guard let collector, collector.isRunning else { return }
    collector.terminate()
    let deadline = Date().addingTimeInterval(2)
    while collector.isRunning && Date() < deadline {
      RunLoop.current.run(until: Date().addingTimeInterval(0.05))
    }
    if collector.isRunning {
      kill(collector.processIdentifier, SIGKILL)
    }
    collectorInput = nil
  }

  private func refresh() {
    var request = URLRequest(url: helperURL)
    request.timeoutInterval = 2
    request.cachePolicy = .reloadIgnoringLocalCacheData
    URLSession.shared.dataTask(with: request) { [weak self] data, response, _ in
      DispatchQueue.main.async {
        guard let self else { return }
        let ok = (response as? HTTPURLResponse)?.statusCode == 200
        guard ok, let data, let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
          self.helperReachable = self.collector?.isRunning == true ? self.helperReachable : false
          if self.collector?.isRunning != true && self.startError == nil {
            self.startError = "The helper is not running."
          }
          self.updateMenu()
          return
        }
        let status = json["status"] as? [String: Any]
        let paired = status?["paired"] as? Bool ?? false
        let needsPairing = status?["needsPairing"] as? Bool ?? false
        self.helperReachable = true
        self.connected = paired && !needsPairing
        self.collecting = status?["collecting"] as? Bool ?? true
        self.startError = nil
        let access = json["logAccess"] as? [[String: Any]] ?? []
        self.blocked = access.compactMap { entry in
          guard entry["state"] as? String == "blocked", let path = entry["path"] as? String else { return nil }
          return path
        }
        self.considerFolderAccess()
        self.updateMenu()
      }
    }.resume()
  }

  private func considerFolderAccess() {
    let key = "apm.requestedFolderAccess"
    if UserDefaults.standard.bool(forKey: key) {
      return
    }
    UserDefaults.standard.set(true, forKey: key)
    if !blocked.isEmpty {
      allowFolderAccess()
    }
  }

  private func updateMenu() {
    if let startError, !helperReachable {
      statusMenuItem.title = startError
    } else if !helperReachable {
      statusMenuItem.title = "Starting…"
    } else {
      var title = connected ? "Connected" : "Not connected"
      if !collecting {
        title += " · paused"
      }
      statusMenuItem.title = title
    }
    pauseItem.title = collecting ? "Pause" : "Resume"
    pauseItem.isEnabled = helperReachable
    guard let menu = statusItem.menu else { return }
    for item in menu.items where item.tag == 2 {
      menu.removeItem(item)
    }
    var index = 1
    for path in blocked {
      let item = NSMenuItem(title: "macOS blocked access to \(displayPath(path))", action: nil, keyEquivalent: "")
      item.tag = 2
      item.isEnabled = false
      menu.insertItem(item, at: index)
      index += 1
    }
    allowItem.isHidden = blocked.isEmpty
    updateIcon()
  }

  private func updateIcon() {
    let symbol: String
    if !blocked.isEmpty {
      symbol = "exclamationmark.triangle"
    } else if helperReachable && !collecting {
      symbol = "pause.circle"
    } else if connected {
      symbol = "map.fill"
    } else {
      symbol = "map"
    }
    guard let button = statusItem?.button else { return }
    if let image = NSImage(systemSymbolName: symbol, accessibilityDescription: "Contour") {
      image.isTemplate = true
      button.image = image
      button.title = ""
    } else {
      button.title = "M"
    }
  }

  private func displayPath(_ path: String) -> String {
    let home = FileManager.default.homeDirectoryForCurrentUser.path
    if path == home {
      return "~"
    }
    if path.hasPrefix(home + "/") {
      return "~" + path.dropFirst(home.count)
    }
    return path
  }

  @objc private func togglePause() {
    let action = collecting ? "pause" : "resume"
    var request = URLRequest(url: helperURL.appendingPathComponent("control").appendingPathComponent(action))
    request.httpMethod = "POST"
    request.timeoutInterval = 2
    URLSession.shared.dataTask(with: request) { [weak self] _, _, _ in
      DispatchQueue.main.async { self?.refresh() }
    }.resume()
  }

  @objc private func openMap() {
    NSWorkspace.shared.open(stagingMap)
  }

  @objc private func allowFolderAccess() {
    let candidates = [
      "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_AllFiles",
      "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles",
    ]
    for candidate in candidates {
      if let url = URL(string: candidate), NSWorkspace.shared.open(url) {
        return
      }
    }
  }

  @objc private func openLoginItems() {
    if let url = URL(string: "x-apple.systempreferences:com.apple.LoginItems-Settings.extension") {
      NSWorkspace.shared.open(url)
    }
  }

  @objc private func quit() {
    quitting = true
    timer?.invalidate()
    stopCollector()
    NSApp.terminate(nil)
  }
}
