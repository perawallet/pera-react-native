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
import CoreImage.CIFilterBuiltins
import SwiftUI
import WidgetKit

struct ReceiveEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
    let target: WidgetSnapshot.ReceiveTarget?
    let qr: UIImage?
}

// The address list only changes inside the app, which reloads every widget
// whenever it writes the snapshot, so there is nothing to refresh on a timer.
struct ReceiveProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> ReceiveEntry {
        ReceiveEntry(date: .now, snapshot: nil, target: nil, qr: nil)
    }

    func snapshot(for configuration: ReceiveConfigIntent, in context: Context) async -> ReceiveEntry {
        entry(configuration)
    }

    func timeline(for configuration: ReceiveConfigIntent, in context: Context) async -> Timeline<ReceiveEntry> {
        Timeline(entries: [entry(configuration)], policy: .never)
    }

    // A picked account that is gone (deleted, or privacy mode on) falls back to the first.
    private func entry(_ configuration: ReceiveConfigIntent) -> ReceiveEntry {
        let snapshot = WidgetSnapshot.current
        let targets = snapshot?.receiveTargets ?? []
        let target = targets.first { $0.address == configuration.account?.id } ?? targets.first
        return ReceiveEntry(date: .now, snapshot: snapshot, target: target, qr: target.flatMap { QRCode.image($0.paymentUri) })
    }
}

enum QRCode {
    /// Black on white at whole-pixel scale; drawn without interpolation so the
    /// modules stay sharp at any widget size.
    static func image(_ text: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 8, y: 8)),
              let image = CIContext().createCGImage(output, from: output.extent)
        else { return nil }
        return UIImage(cgImage: image)
    }
}

struct ReceiveWidgetView: View {
    let entry: ReceiveEntry

    var body: some View {
        Group {
            if let target = entry.target, let qr = entry.qr {
                content(target, qr: qr)
                    // The address and its QR: blanked whenever the phone is
                    // locked (lock screen, StandBy, Mac desktop).
                    .privacySensitive()
                    .peraChrome(network: entry.snapshot?.network)
            } else {
                VStack(spacing: 0) {
                    NetworkBar(network: entry.snapshot?.network)
                    PeraPlaceholder()
                }
            }
        }
        .peraEnvironment(entry.snapshot)
        .containerBackground(for: .widget) { PeraColor.background }
        .widgetURL(accountURL)
    }

    // The account the widget shows, on its own chain; the app when there is none.
    private var accountURL: URL? {
        guard let target = entry.target else { return URL(string: "perawallet://app/") }
        var components = URLComponents(string: "perawallet://app/account-detail/")
        components?.queryItems = [URLQueryItem(name: "address", value: target.address)]
            + (target.chain.map { [URLQueryItem(name: "chain", value: $0)] } ?? [])
        return components?.url
    }

    private func content(_ target: WidgetSnapshot.ReceiveTarget, qr: UIImage) -> some View {
        VStack(spacing: 6) {
            qrView(qr)
            Text(target.name)
                .font(PeraFont.medium(11))
                .foregroundStyle(PeraColor.textMain)
                .lineLimit(1)
        }
        .padding(12)
        // Keeps the QR clear of the corner badge.
        .padding(.top, 8)
    }

    // White quiet zone in both themes: scanners need dark modules on light.
    private func qrView(_ qr: UIImage) -> some View {
        Image(uiImage: qr)
            .interpolation(.none)
            .resizable()
            .scaledToFit()
            .padding(5)
            .background(Color.white, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

struct ReceiveWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "PeraReceiveWidget", intent: ReceiveConfigIntent.self, provider: ReceiveProvider()) { entry in
            ReceiveWidgetView(entry: entry)
        }
        .configurationDisplayName(String(localized: "receive.name"))
        .description(String(localized: "receive.description"))
        .supportedFamilies([.systemSmall])
        // Not offered for StandBy. iOS can't forbid placing it there, so the
        // content is privacy-sensitive as well.
        .disfavoredLocations([.standBy], for: [.systemSmall])
        .contentMarginsDisabled()
    }
}

#Preview("Receive QR", as: .systemSmall) {
    ReceiveWidget()
} timeline: {
    let target = WidgetSnapshot.fixtureMainnet.receiveTargets?.first
    ReceiveEntry(date: .now, snapshot: .fixtureMainnet, target: target, qr: target.flatMap { QRCode.image($0.paymentUri) })
    ReceiveEntry(date: .now, snapshot: .fixtureTestnetHidden, target: nil, qr: nil)
}
