// swift-tools-version:5.9
// Unit tests for the widget extension's Foundation-only logic (fetchers,
// transaction classifier, snapshot model). Sources/WidgetCore holds symlinks to
// the files the extension ships, so the tests compile exactly that code. Run
// with `swift test` from this folder; it needs no simulator or Xcode project.
import PackageDescription

let package = Package(
    name: "WidgetCore",
    platforms: [.macOS(.v14)],
    targets: [
        .target(name: "WidgetCore"),
        .testTarget(name: "WidgetCoreTests", dependencies: ["WidgetCore"]),
    ]
)
