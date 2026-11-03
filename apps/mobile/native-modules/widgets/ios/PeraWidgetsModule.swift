/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */
import ExpoModulesCore
import ImageIO
import UniformTypeIdentifiers
import WidgetKit

// Keys and paths are read by targets/_shared/SnapshotStore.swift; change both together.
private let snapshotKey = "pera.widgets.snapshot"
private let imagesFolder = "widgets"
private let maxImageBytes = 10 * 1024 * 1024
private let maxPixelSize = 600
private let downloadTimeout: TimeInterval = 15
// Written by OpenScannerIntent (targets/_shared/WidgetSnapshot.swift).
private let pendingScanKey = "pera.widgets.pendingScan"
// A request older than this was never handled; it must not open the scanner later.
private let pendingScanLifetime: TimeInterval = 60
// Posted by OpenScannerIntent after it records a request.
private let scanRequestedNotification = "app.perawallet.widgets.scanRequested"
// Every App Group key the widgets write starts with this: the snapshot, page state, NFT rotation anchors
// and the pending scan.
private let widgetKeyPrefix = "pera.widgets."

/// The Darwin observer. A C callback can't capture, so the pointer it gets is this immortal singleton, and
/// the module behind it is weak: a module torn down without OnStopObserving (a JS reload) is simply gone.
private final class ScanObserver {
  static let shared = ScanObserver()

  private weak var module: PeraWidgetsModule?
  private var isRegistered = false

  func start(_ module: PeraWidgetsModule) {
    self.module = module
    guard !isRegistered else { return }
    isRegistered = true
    CFNotificationCenterAddObserver(
      CFNotificationCenterGetDarwinNotifyCenter(),
      Unmanaged.passUnretained(self).toOpaque(),
      { _, observer, _, _, _ in
        guard let observer else { return }
        Unmanaged<ScanObserver>.fromOpaque(observer).takeUnretainedValue().module?.sendEvent("onScanRequested")
      },
      scanRequestedNotification as CFString,
      nil,
      .deliverImmediately
    )
  }

  func stop(_ module: PeraWidgetsModule) {
    if self.module === module {
      self.module = nil
    }
  }
}

/// Just what the image download needs from the snapshot the app wrote.
private struct PinnedBackend: Decodable {
  struct Feed: Decodable {
    struct Pinning: Decodable {
      let publicKeyHashes: [String]
      let expiresAt: String
    }

    let backendUrl: String
    let pinning: Pinning?
  }

  let priceFeed: Feed?
}

public class PeraWidgetsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PeraWidgets")

    Events("onScanRequested")

    OnStartObserving {
      ScanObserver.shared.start(self)
    }

    OnStopObserving {
      ScanObserver.shared.stop(self)
    }

    AsyncFunction("writeSnapshot") { (json: String) in
      guard let defaults = Self.sharedDefaults() else { return }
      // The app rewrites on every trip to the background. A reload rebuilds
      // every timeline and spends each widget's refresh budget, so only an
      // actual change earns one.
      guard defaults.string(forKey: snapshotKey) != json else { return }
      defaults.set(json, forKey: snapshotKey)
      WidgetCenter.shared.reloadAllTimelines()
    }

    AsyncFunction("clearSnapshot") {
      if let defaults = Self.sharedDefaults() {
        for key in defaults.dictionaryRepresentation().keys where key.hasPrefix(widgetKeyPrefix) {
          defaults.removeObject(forKey: key)
        }
      }
      if let directory = Self.imagesDirectory() {
        try? FileManager.default.removeItem(at: directory)
      }
      WidgetCenter.shared.reloadAllTimelines()
    }

    AsyncFunction("consumePendingScan") { () -> Bool in
      guard let defaults = Self.sharedDefaults() else { return false }
      let requestedAt = defaults.double(forKey: pendingScanKey)
      guard requestedAt > 0 else { return false }
      defaults.removeObject(forKey: pendingScanKey)
      return Date().timeIntervalSince1970 - requestedAt <= pendingScanLifetime
    }

    AsyncFunction("syncImages") { (items: [[String: String]]) async -> [String] in
      guard let directory = Self.imagesDirectory() else { return [] }
      try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

      var requested: [(key: String, url: URL)] = []
      for item in items {
        guard let key = item["key"], Self.isSafeKey(key),
              let raw = item["url"], let url = URL(string: raw), url.scheme == "https",
              !requested.contains(where: { $0.key == key })
        else { continue }
        requested.append((key, url))
      }

      Self.deleteStale(in: directory, keeping: Set(requested.map(\.key)))

      let backend = Self.pinnedBackend()
      var cached: [String] = []
      for (key, url) in requested {
        let file = Self.imageFile(in: directory, key: key)
        if FileManager.default.fileExists(atPath: file.path) {
          cached.append(key)
        } else if await Self.downloadThumbnail(from: url, to: file, backend: backend) {
          cached.append(key)
        }
      }
      return cached
    }
  }

  // Written into the app's Info.plist by the passkey-autofill config plugin.
  private static func appGroup() -> String? {
    Bundle.main.object(forInfoDictionaryKey: "AppGroupIdentifier") as? String
  }

  private static func pinnedBackend() -> PinnedBackend.Feed? {
    guard let json = sharedDefaults()?.string(forKey: snapshotKey), let data = json.data(using: .utf8) else { return nil }
    return (try? JSONDecoder().decode(PinnedBackend.self, from: data))?.priceFeed
  }

  // Images on the Pera backend's own host get the widget's pins (WidgetPinning.swift, symlinked from the
  // widget target); NFT metadata points everywhere else, which the app doesn't pin either.
  private static func session(for url: URL, backend: PinnedBackend.Feed?) -> URLSession? {
    guard let backend, let pinning = backend.pinning,
          let host = URL(string: backend.backendUrl)?.host, url.host == host
    else { return nil }
    return WidgetPinning.session(hashes: pinning.publicKeyHashes, expiresAt: pinning.expiresAt)
  }

  private static func sharedDefaults() -> UserDefaults? {
    appGroup().flatMap(UserDefaults.init(suiteName:))
  }

  private static func imagesDirectory() -> URL? {
    appGroup()
      .flatMap { FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: $0) }?
      .appendingPathComponent(imagesFolder, isDirectory: true)
  }

  private static func imageFile(in directory: URL, key: String) -> URL {
    directory.appendingPathComponent("nft-\(key).jpg")
  }

  // Keys become file names; asset ids are digits, so anything else is refused.
  private static func isSafeKey(_ key: String) -> Bool {
    !key.isEmpty && key.allSatisfy { $0.isASCII && $0.isNumber }
  }

  private static func deleteStale(in directory: URL, keeping keys: Set<String>) {
    let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
    for file in files {
      let name = file.deletingPathExtension().lastPathComponent
      let key = name.hasPrefix("nft-") ? String(name.dropFirst(4)) : name
      if !keys.contains(key) {
        try? FileManager.default.removeItem(at: file)
      }
    }
  }

  // NFT metadata URLs are untrusted: cap the size while streaming, decode only as an image, and
  // downsample so the widget never holds a full-resolution bitmap (its process
  // is killed silently around 30 MB). GIFs come out as their first frame.
  private static func downloadThumbnail(from url: URL, to file: URL, backend: PinnedBackend.Feed?) async -> Bool {
    var request = URLRequest(url: url)
    request.timeoutInterval = downloadTimeout
    let pinned = session(for: url, backend: backend)
    defer { pinned?.finishTasksAndInvalidate() }
    guard let data = await download(request, session: pinned ?? .shared),
          let source = CGImageSourceCreateWithData(data as CFData, nil)
    else { return false }

    let options: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceThumbnailMaxPixelSize: maxPixelSize,
    ]
    guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary),
          let destination = CGImageDestinationCreateWithURL(
            file as CFURL, UTType.jpeg.identifier as CFString, 1, nil)
    else { return false }
    CGImageDestinationAddImage(
      destination, image, [kCGImageDestinationLossyCompressionQuality: 0.85] as CFDictionary)
    return CGImageDestinationFinalize(destination)
  }

  /// Nil on failure, or as soon as the body passes maxImageBytes, declared or not.
  private static func download(_ request: URLRequest, session: URLSession) async -> Data? {
    guard let (bytes, response) = try? await session.bytes(for: request),
          (response as? HTTPURLResponse)?.statusCode == 200
    else { return nil }
    guard response.expectedContentLength <= Int64(maxImageBytes) else {
      bytes.task.cancel()
      return nil
    }
    var data = Data()
    if response.expectedContentLength > 0 {
      data.reserveCapacity(Int(response.expectedContentLength))
    }
    do {
      for try await byte in bytes {
        data.append(byte)
        if data.count > maxImageBytes {
          bytes.task.cancel()
          return nil
        }
      }
    } catch {
      return nil
    }
    return data
  }
}
