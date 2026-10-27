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
import Charts
import SwiftUI
import WidgetKit

// Colour sets are generated from expo-target.config.js, hand-copied from the
// app's theme tokens (src/theme/tokens/light.ts and dark.ts) under the same names.
enum PeraColor {
    static let background = Color("background")
    static let layer = Color("layerGrayLighter")
    static let textMain = Color("textMain")
    static let textGray = Color("textGray")
    static let positive = Color("positive")
    static let negative = Color("negative")
    static let testnetBg = Color("testnetBg")
    static let testnetText = Color("testnetText")
}

enum PeraFont {
    // PostScript names of the DM Sans files bundled in fonts/ (UIAppFonts).
    static func regular(_ size: CGFloat) -> Font { .custom("DMSans-Regular", size: size) }
    static func medium(_ size: CGFloat) -> Font { .custom("DMSans-Medium", size: size) }
    static func bold(_ size: CGFloat) -> Font { .custom("DMSans-Bold", size: size) }
}

struct NetworkBar: View {
    let network: WidgetSnapshot.Network?

    var body: some View {
        if let network, !network.isMainnet {
            Text(network.label)
                .font(PeraFont.medium(11))
                .foregroundStyle(PeraColor.testnetText)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 3)
                .background(PeraColor.testnetBg)
        }
    }
}

struct PeraPlaceholder: View {
    var body: some View {
        Image("peraLogo")
            .resizable()
            .scaledToFit()
            .frame(width: 44, height: 44)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct PeraBadge: View {
    var body: some View {
        Image("peraLogo")
            .resizable()
            .frame(width: 18, height: 18)
            .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
            .shadow(color: .black.opacity(0.25), radius: 2, y: 1)
    }
}

extension View {
    /// The network bar on top, then the content with the Pera badge in its top
    /// corner, so the badge never sits under the bar.
    func peraChrome(network: WidgetSnapshot.Network?) -> some View {
        VStack(spacing: 0) {
            NetworkBar(network: network)
            self
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .overlay(alignment: .topTrailing) {
                    PeraBadge().padding(10)
                }
        }
    }

    /// Applies the app's language, layout direction and theme to widget content.
    func peraEnvironment(_ snapshot: WidgetSnapshot?) -> some View {
        modifier(PeraEnvironment(snapshot: snapshot))
    }
}

private struct PeraEnvironment: ViewModifier {
    let snapshot: WidgetSnapshot?
    @Environment(\.colorScheme) private var systemScheme

    func body(content: Content) -> some View {
        let locale = snapshot?.locale.map(Locale.init(identifier:)) ?? .current
        let isRTL = Locale.Language(identifier: locale.identifier).characterDirection == .rightToLeft
        content
            .environment(\.locale, locale)
            .environment(\.layoutDirection, isRTL ? .rightToLeft : .leftToRight)
            .environment(\.colorScheme, scheme)
    }

    private var scheme: ColorScheme {
        switch snapshot?.theme {
        case "light": .light
        case "dark": .dark
        default: systemScheme
        }
    }
}

extension WidgetSnapshot {
    static var current: WidgetSnapshot? { SnapshotStore.load() }
}

/// "Updated 14:05" in the app's language. Re-rendered from the minute entries
/// (see minuteEntries), so the day appears once the data is from before midnight.
struct UpdatedLabel: View {
    let prefix: String?
    let date: Date
    /// The timeline entry's date, i.e. the moment this frame is shown.
    let now: Date
    @Environment(\.locale) private var locale

    var body: some View {
        Text([prefix, UpdatedTime.text(for: date, now: now, locale: locale)].compactMap { $0 }.joined(separator: " "))
            .font(PeraFont.regular(10))
            .foregroundStyle(PeraColor.textGray)
            .lineLimit(1)
    }
}

/// One entry per minute from now until `end`, so the rows' "5 min ago" ages advance
/// between refreshes without spending the reload budget.
func minuteEntries<Entry: TimelineEntry>(until end: Date, _ make: (Date) -> Entry) -> [Entry] {
    stride(from: Date.now.timeIntervalSinceReferenceDate, to: end.timeIntervalSinceReferenceDate, by: 60)
        .map { make(Date(timeIntervalSinceReferenceDate: $0)) }
}

struct Sparkline: View {
    let values: [Double]
    let color: Color

    var body: some View {
        Chart(Array(values.enumerated()), id: \.offset) { point in
            LineMark(x: .value("t", point.offset), y: .value("v", point.element))
                .interpolationMethod(.catmullRom)
                .foregroundStyle(color)
        }
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
        .chartYScale(domain: (values.min() ?? 0)...(values.max() ?? 1))
    }
}

/// Green when the series ends at or above where it started, red otherwise.
func trendColor(_ change: Double?) -> Color {
    (change ?? 0) >= 0 ? PeraColor.positive : PeraColor.negative
}
