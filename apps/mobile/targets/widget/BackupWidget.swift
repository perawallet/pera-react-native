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

struct BackupEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
}

// Backup status only changes inside the app, which reloads every widget
// whenever it writes the snapshot, so there is nothing to refresh on a timer.
struct BackupProvider: TimelineProvider {
    func placeholder(in context: Context) -> BackupEntry {
        BackupEntry(date: .now, snapshot: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (BackupEntry) -> Void) {
        completion(BackupEntry(date: .now, snapshot: .current))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BackupEntry>) -> Void) {
        completion(Timeline(entries: [BackupEntry(date: .now, snapshot: .current)], policy: .never))
    }
}

enum BackupKind {
    case cloud
    case passphrase

    var url: URL? {
        switch self {
        case .cloud: URL(string: "perawallet://app/cloud-backup/")
        case .passphrase: URL(string: "perawallet://app/passphrase-backup/")
        }
    }

    var symbol: String {
        switch self {
        case .cloud: "icloud"
        case .passphrase: "key"
        }
    }

    func header(_ snapshot: WidgetSnapshot?) -> String {
        snapshot?.string(self == .cloud ? "cloudBackup" : "passphraseBackup") ?? ""
    }

    func line(_ snapshot: WidgetSnapshot?) -> WidgetSnapshot.Backup.Line? {
        self == .cloud ? snapshot?.backup?.cloud : snapshot?.backup?.passphrase
    }
}

/// One backup's status: header, state icon, title and detail.
struct BackupStatusView: View {
    let kind: BackupKind
    let snapshot: WidgetSnapshot?
    /// Leaves room for the corner badge beside the header.
    var clearsBadge = true

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Two lines: longer names ("Passphrase Backup", most translations)
            // don't fit beside the corner badge on one.
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Image(systemName: kind.symbol).font(.system(size: 11))
                Text(kind.header(snapshot)).font(PeraFont.medium(12))
            }
            .foregroundStyle(PeraColor.textGray)
            .lineLimit(2)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.trailing, clearsBadge ? 24 : 0)
            Spacer(minLength: 0)
            stateIcon.font(.system(size: 20))
            Text(line?.title ?? snapshot?.string("notAvailable") ?? "—")
                .font(PeraFont.bold(15))
                .foregroundStyle(PeraColor.textMain)
                .lineLimit(2)
                .minimumScaleFactor(0.7)
            if let detail = line?.detail {
                Text(detail)
                    .font(PeraFont.regular(11))
                    .foregroundStyle(PeraColor.textGray)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var line: WidgetSnapshot.Backup.Line? { kind.line(snapshot) }

    // A distinct glyph per state as well as colour: tinted and vibrant
    // rendering modes drop the colour.
    @ViewBuilder
    private var stateIcon: some View {
        switch line?.state {
        case "backedUp":
            Image(systemName: "checkmark.circle.fill").foregroundStyle(PeraColor.positive)
        case nil:
            Image(systemName: "minus.circle").foregroundStyle(PeraColor.textGray)
        default:
            Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(PeraColor.negative)
        }
    }
}

struct SingleBackupWidgetView: View {
    let kind: BackupKind
    let entry: BackupEntry

    var body: some View {
        Group {
            if entry.snapshot?.backup == nil {
                VStack(spacing: 0) {
                    NetworkBar(network: entry.snapshot?.network)
                    PeraPlaceholder()
                }
            } else {
                BackupStatusView(kind: kind, snapshot: entry.snapshot)
                    .padding(14)
                    .peraChrome(network: entry.snapshot?.network)
            }
        }
        .peraEnvironment(entry.snapshot)
        .containerBackground(for: .widget) { PeraColor.background }
        // Cloud backup not offered here: open the app rather than a link it refuses.
        .widgetURL(kind.line(entry.snapshot) == nil ? URL(string: "perawallet://app/") : kind.url)
    }
}

struct BackupsWidgetView: View {
    let entry: BackupEntry

    var body: some View {
        Group {
            if entry.snapshot?.backup == nil {
                VStack(spacing: 0) {
                    NetworkBar(network: entry.snapshot?.network)
                    PeraPlaceholder()
                }
            } else {
                // Medium widgets take a link per region, so each half opens its own flow.
                HStack(spacing: 12) {
                    pane(.cloud, clearsBadge: false)
                    Divider()
                    pane(.passphrase, clearsBadge: true)
                }
                .padding(14)
                .peraChrome(network: entry.snapshot?.network)
            }
        }
        .peraEnvironment(entry.snapshot)
        .containerBackground(for: .widget) { PeraColor.background }
        .widgetURL(URL(string: "perawallet://app/"))
    }

    @ViewBuilder
    private func pane(_ kind: BackupKind, clearsBadge: Bool) -> some View {
        let status = BackupStatusView(kind: kind, snapshot: entry.snapshot, clearsBadge: clearsBadge)
        if kind.line(entry.snapshot) != nil, let url = kind.url {
            Link(destination: url) { status }
        } else {
            status
        }
    }
}

struct CloudBackupWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "PeraCloudBackupWidget", provider: BackupProvider()) { entry in
            SingleBackupWidgetView(kind: .cloud, entry: entry)
        }
        .configurationDisplayName(String(localized: "cloudBackup.name"))
        .description(String(localized: "cloudBackup.description"))
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

struct PassphraseBackupWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "PeraPassphraseBackupWidget", provider: BackupProvider()) { entry in
            SingleBackupWidgetView(kind: .passphrase, entry: entry)
        }
        .configurationDisplayName(String(localized: "passphraseBackup.name"))
        .description(String(localized: "passphraseBackup.description"))
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

struct BackupsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "PeraBackupsWidget", provider: BackupProvider()) { entry in
            BackupsWidgetView(entry: entry)
        }
        .configurationDisplayName(String(localized: "backups.name"))
        .description(String(localized: "backups.description"))
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

#Preview("Cloud", as: .systemSmall) {
    CloudBackupWidget()
} timeline: {
    BackupEntry(date: .now, snapshot: .fixtureMainnet)
    BackupEntry(date: .now, snapshot: .fixtureTestnetHidden)
    BackupEntry(date: .now, snapshot: nil)
}

#Preview("Passphrase", as: .systemSmall) {
    PassphraseBackupWidget()
} timeline: {
    BackupEntry(date: .now, snapshot: .fixtureMainnet)
    BackupEntry(date: .now, snapshot: .fixtureTestnetHidden)
}

#Preview("Backups", as: .systemMedium) {
    BackupsWidget()
} timeline: {
    BackupEntry(date: .now, snapshot: .fixtureMainnet)
    BackupEntry(date: .now, snapshot: .fixtureTestnetHidden)
}
