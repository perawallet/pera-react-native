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
import AppIntents
import SwiftUI
import WidgetKit

/// Which page a multi-page widget shows, per widget kind. Kept in the App
/// Group because a widget button's intent can't reach the timeline any other
/// way; every copy of the same kind on screen shares it.
enum WidgetPageStore {
    static let portfolioButton = "portfolio"
    static let portfolioTabs = "portfolioTabs"
    static let inboxTabs = "inboxTabs"

    private static var defaults: UserDefaults? { SnapshotStore.appGroup.flatMap(UserDefaults.init(suiteName:)) }

    static func page(_ key: String) -> Int {
        defaults?.integer(forKey: "pera.widgets.\(key).page") ?? 0
    }

    static func set(_ page: Int, _ key: String) {
        defaults?.set(page, forKey: "pera.widgets.\(key).page")
    }
}

/// A segment of the tab bar: shows its page directly rather than toggling, so
/// a tap always lands where the label says.
struct SetWidgetPageIntent: AppIntent {
    static let title: LocalizedStringResource = "options.flipPage"
    static let isDiscoverable = false

    @Parameter(title: "options.flipPage")
    var key: String

    @Parameter(title: "options.flipPage")
    var page: Int

    init() {}

    init(key: String, page: Int) {
        self.key = key
        self.page = page
    }

    func perform() async throws -> some IntentResult {
        WidgetPageStore.set(page, key)
        return .result()
    }
}

/// One page of a multi-page widget: an icon for the bar, a label for VoiceOver.
struct WidgetPageTab {
    let symbol: String
    let label: String
}

/// Two or more icon buttons along the bottom of a widget, the current page
/// filled. Each is its own button, wide and tall enough to hit without
/// aiming, and icons need no room for translated labels.
struct SegmentedPageBar: View {
    let key: String
    let tabs: [WidgetPageTab]
    let selected: Int

    var body: some View {
        HStack(spacing: 6) {
            ForEach(tabs.indices, id: \.self) { index in
                Button(intent: SetWidgetPageIntent(key: key, page: index)) {
                    Image(systemName: tabs[index].symbol)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(index == selected ? PeraColor.background : PeraColor.textGray)
                        .frame(maxWidth: .infinity, minHeight: 28)
                        .background(
                            index == selected ? PeraColor.textMain : PeraColor.layer,
                            in: RoundedRectangle(cornerRadius: 9, style: .continuous)
                        )
                        .contentShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(tabs[index].label)
                .accessibilityAddTraits(index == selected ? .isSelected : [])
            }
        }
    }
}
