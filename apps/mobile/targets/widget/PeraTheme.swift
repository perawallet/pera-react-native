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

extension View {
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

// Relative timestamps formatted in the snapshot's locale ("2 hours ago").
struct UpdatedLabel: View {
    let prefix: String?
    let date: Date

    var body: some View {
        HStack(spacing: 3) {
            if let prefix { Text(prefix) }
            Text(date, style: .relative)
        }
        .font(PeraFont.regular(10))
        .foregroundStyle(PeraColor.textGray)
        .lineLimit(1)
    }
}
