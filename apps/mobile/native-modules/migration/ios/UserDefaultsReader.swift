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

import Foundation

final class UserDefaultsReader {

    struct Preferences {
        var theme: String?
        var currency: String?
        var privacyMode: Bool?
        var termsAcceptedVersion: Int?
        var lockAttemptCount: Int?
        var lockPenaltyRemainingMs: Int64?
        var notificationRefreshTimestampMs: Int64?
        var copyAddressCount: Int?
        var lastSeenNotificationId: Int64?

        var assetFilterZeroBalance: Bool?
        var assetFilterDisplayNFT: Bool?
        var assetFilterDisplayOptedInNFT: Bool?
        var nftFilterDisplayWatchAccountNFTs: Bool?
        var collectibleFilterNotOwned: Bool?
        var nftListingViewType: String?

        var swapTermsAccepted: Bool?
        var swapLastUsedAddress: String?
        var swapUseLocalCurrency: Bool?

        var pinSetupPromptDismissed: Bool?

        var accountSortRawDisplayName: String?
        var assetSortRawDisplayName: String?
        var collectibleSortRawDisplayName: String?

        var rawFlags: [String: Any] = [:]
    }

    func readDismissedBannerIds() -> [String] {
        guard let data = defaults.data(
            forKey: LegacyMigrationConstants.DefaultsKey.announcementState
        ) else { return [] }
        guard let parsed = try? JSONSerialization.jsonObject(with: data),
              let dict = parsed as? [String: [String: Any]]
        else { return [] }
        return dict.compactMap { (id, meta) -> String? in
            guard (meta["isHidden"] as? Bool) == true else { return nil }
            return id
        }
    }

    struct Tooltips {
        var qrTooltipSeen: Bool?
        var copyAddressTooltipSeen: Bool?
        var copyAddressPromoSeen: Bool?
        var transactionTutorialSeen: Bool?
        var privacyModeTooltipSeen: Bool?
        var jointAccountDisclaimerSeen: Bool?
        var walletConnectWarningSeen: Bool?
        var swapIntroSeen: Bool?
        var giftCardsIntroSeen: Bool?
        var ledgerPairingWarningSeen: Bool?
        var transactionInfoDismissed: Bool?
    }

    private let defaults: UserDefaults
    private let suiteName: String

    init?(suiteName: String) {
        guard let suite = UserDefaults(suiteName: suiteName) else { return nil }
        self.defaults = suite
        self.suiteName = suiteName
    }

    func read() -> Preferences {
        var prefs = Preferences()

        prefs.theme = string(LegacyMigrationConstants.DefaultsKey.theme).flatMap(normalizeTheme)
        prefs.currency = string(LegacyMigrationConstants.DefaultsKey.currency)
            .flatMap(extractCurrencyId)

        prefs.privacyMode = optionalBool(LegacyMigrationConstants.DefaultsKey.privacyMode)
        prefs.termsAcceptedVersion = optionalBool(
            LegacyMigrationConstants.DefaultsKey.termsAcceptedV2
        ).flatMap { $0 ? 2 : nil }

        prefs.lockAttemptCount = optionalInt(
            LegacyMigrationConstants.DefaultsKey.lockAttemptCount
        )

        if let sec = optionalDouble(LegacyMigrationConstants.DefaultsKey.lockPenaltyRemainingSec) {
            prefs.lockPenaltyRemainingMs = Int64(sec * 1000)
        }
        if let sec = optionalDouble(
            LegacyMigrationConstants.DefaultsKey.notificationRefreshTimestampSec
        ) {
            prefs.notificationRefreshTimestampMs = Int64(sec * 1000)
        }

        prefs.copyAddressCount = optionalInt(
            LegacyMigrationConstants.DefaultsKey.copyAddressCount
        )

        if let lastSeen = optionalInt64(
            LegacyMigrationConstants.DefaultsKey.lastSeenNotificationId
        ) {
            prefs.lastSeenNotificationId = lastSeen
        }

        prefs.assetFilterZeroBalance = optionalBool(
            LegacyMigrationConstants.DefaultsKey.assetFilterZeroBalance
        )
        prefs.assetFilterDisplayNFT = optionalBool(
            LegacyMigrationConstants.DefaultsKey.assetFilterDisplayNFT
        )
        prefs.assetFilterDisplayOptedInNFT = optionalBool(
            LegacyMigrationConstants.DefaultsKey.assetFilterDisplayOptedInNFT
        )
        prefs.nftFilterDisplayWatchAccountNFTs = optionalBool(
            LegacyMigrationConstants.DefaultsKey.nftFilterDisplayWatchAccountNFTs
        )

        if let collectibleFilterRaw = optionalInt(
            LegacyMigrationConstants.DefaultsKey.collectibleFilterNotOwned
        ) {
            prefs.collectibleFilterNotOwned = (collectibleFilterRaw == 0)
        }

        if let listingViewRaw = optionalInt(
            LegacyMigrationConstants.DefaultsKey.nftListingViewType
        ) {
            switch listingViewRaw {
            case 0: prefs.nftListingViewType = "grid"
            case 1: prefs.nftListingViewType = "list"
            default: break
            }
        }

        prefs.swapTermsAccepted = optionalBool(
            LegacyMigrationConstants.DefaultsKey.swapTermsAccepted
        )
        prefs.swapLastUsedAddress = string(
            LegacyMigrationConstants.DefaultsKey.swapLastUsedAddress
        )
        prefs.swapUseLocalCurrency = optionalBool(
            LegacyMigrationConstants.DefaultsKey.swapUseLocalCurrency
        )

        prefs.pinSetupPromptDismissed = optionalBool(
            LegacyMigrationConstants.DefaultsKey.passcodeDontAskAgain
        )

        prefs.accountSortRawDisplayName = string(
            LegacyMigrationConstants.DefaultsKey.accountSort
        )
        prefs.assetSortRawDisplayName = string(
            LegacyMigrationConstants.DefaultsKey.assetSort
        )
        prefs.collectibleSortRawDisplayName = string(
            LegacyMigrationConstants.DefaultsKey.collectibleSort
        )

        prefs.rawFlags = buildRawFlags()

        return prefs
    }

    func readTooltips() -> Tooltips {
        var t = Tooltips()
        t.qrTooltipSeen = optionalBool(LegacyMigrationConstants.DefaultsKey.tooltipQr)
        t.copyAddressTooltipSeen = optionalBool(LegacyMigrationConstants.DefaultsKey.tooltipCopyAddress)
        t.copyAddressPromoSeen = optionalBool(LegacyMigrationConstants.DefaultsKey.tooltipCopyAddressPromo)
        t.transactionTutorialSeen = optionalBool(LegacyMigrationConstants.DefaultsKey.tooltipTransactionTutorial)
        t.privacyModeTooltipSeen = optionalBool(LegacyMigrationConstants.DefaultsKey.tooltipPrivacyMode)
        t.jointAccountDisclaimerSeen = optionalBool(LegacyMigrationConstants.DefaultsKey.tooltipJointAccountDisclaimer)
        t.walletConnectWarningSeen = optionalBool(LegacyMigrationConstants.DefaultsKey.tooltipWalletConnectWarning)
        t.swapIntroSeen = optionalBool(LegacyMigrationConstants.DefaultsKey.tooltipSwapIntro)
        t.giftCardsIntroSeen = optionalBool(LegacyMigrationConstants.DefaultsKey.tooltipGiftCardsIntro)
        t.ledgerPairingWarningSeen = optionalBool(LegacyMigrationConstants.DefaultsKey.tooltipLedgerPairingWarning)
        t.transactionInfoDismissed = optionalBool(LegacyMigrationConstants.DefaultsKey.tooltipTransactionInfoDismissed)
        return t
    }

    private func buildRawFlags() -> [String: Any] {
        let all = defaults.dictionaryRepresentation()
        var out: [String: Any] = [:]
        for key in all.keys.sorted() {
            if out.count >= Self.rawFlagsMaxEntries { break }
            if Self.typedDefaultsKeys.contains(key) { continue }
            if Self.isAppleSystemKey(key) { continue }
            guard let scalar = Self.scalarBridgeValue(all[key]) else { continue }
            out[key] = scalar
        }
        return out
    }

    private static func isAppleSystemKey(_ key: String) -> Bool {
        key.hasPrefix("Apple") || key.hasPrefix("NS") || key.hasPrefix("com.apple")
    }

    private static func scalarBridgeValue(_ value: Any?) -> Any? {
        guard let value = value else { return NSNull() }
        if value is String { return value }
        if value is NSNumber { return value }
        return nil
    }

    private static let rawFlagsMaxEntries = 50

    private static let typedDefaultsKeys: Set<String> = [
        LegacyMigrationConstants.DefaultsKey.theme,
        LegacyMigrationConstants.DefaultsKey.currency,
        LegacyMigrationConstants.DefaultsKey.termsAcceptedV2,
        LegacyMigrationConstants.DefaultsKey.lockAttemptCount,
        LegacyMigrationConstants.DefaultsKey.lockPenaltyRemainingSec,
        LegacyMigrationConstants.DefaultsKey.notificationRefreshTimestampSec,
        LegacyMigrationConstants.DefaultsKey.copyAddressCount,
        LegacyMigrationConstants.DefaultsKey.lastSeenNotificationId,
        LegacyMigrationConstants.DefaultsKey.privacyMode,
        LegacyMigrationConstants.DefaultsKey.assetFilterZeroBalance,
        LegacyMigrationConstants.DefaultsKey.assetFilterDisplayNFT,
        LegacyMigrationConstants.DefaultsKey.assetFilterDisplayOptedInNFT,
        LegacyMigrationConstants.DefaultsKey.nftFilterDisplayWatchAccountNFTs,
        LegacyMigrationConstants.DefaultsKey.collectibleFilterNotOwned,
        LegacyMigrationConstants.DefaultsKey.nftListingViewType,
        LegacyMigrationConstants.DefaultsKey.accountSort,
        LegacyMigrationConstants.DefaultsKey.assetSort,
        LegacyMigrationConstants.DefaultsKey.collectibleSort,
        LegacyMigrationConstants.DefaultsKey.swapTermsAccepted,
        LegacyMigrationConstants.DefaultsKey.swapLastUsedAddress,
        LegacyMigrationConstants.DefaultsKey.swapUseLocalCurrency,
        LegacyMigrationConstants.DefaultsKey.tooltipQr,
        LegacyMigrationConstants.DefaultsKey.tooltipCopyAddress,
        LegacyMigrationConstants.DefaultsKey.tooltipCopyAddressPromo,
        LegacyMigrationConstants.DefaultsKey.tooltipTransactionTutorial,
        LegacyMigrationConstants.DefaultsKey.tooltipPrivacyMode,
        LegacyMigrationConstants.DefaultsKey.tooltipJointAccountDisclaimer,
        LegacyMigrationConstants.DefaultsKey.tooltipWalletConnectWarning,
        LegacyMigrationConstants.DefaultsKey.tooltipSwapIntro,
        LegacyMigrationConstants.DefaultsKey.tooltipGiftCardsIntro,
        LegacyMigrationConstants.DefaultsKey.tooltipLedgerPairingWarning,
        LegacyMigrationConstants.DefaultsKey.tooltipTransactionInfoDismissed,
        LegacyMigrationConstants.DefaultsKey.passcodeDontAskAgain,
        LegacyMigrationConstants.DefaultsKey.passcodeAppCount,
        LegacyMigrationConstants.DefaultsKey.appReviewStartCount,
        LegacyMigrationConstants.DefaultsKey.lastVersionReviewed,
        LegacyMigrationConstants.DefaultsKey.storeAppIsOnboarding,
        LegacyMigrationConstants.DefaultsKey.localAuthenticationStatus,
        LegacyMigrationConstants.DefaultsKey.announcementState,
        LegacyMigrationConstants.DefaultsKey.termsServicesV1,
        LegacyMigrationConstants.DefaultsKey.secureBackups,
        LegacyMigrationConstants.DefaultsKey.watchedJointAccountInvitations,
        LegacyMigrationConstants.DefaultsKey.watchedSignRequestMessage,
    ]

    private func string(_ key: String) -> String? {
        defaults.object(forKey: key) as? String
    }

    private func optionalBool(_ key: String) -> Bool? {
        defaults.object(forKey: key) as? Bool
    }

    private func optionalInt(_ key: String) -> Int? {
        if let n = defaults.object(forKey: key) as? NSNumber {
            return n.intValue
        }
        return nil
    }

    private func optionalInt64(_ key: String) -> Int64? {
        if let n = defaults.object(forKey: key) as? NSNumber {
            return n.int64Value
        }
        return nil
    }

    private func optionalDouble(_ key: String) -> Double? {
        if let n = defaults.object(forKey: key) as? NSNumber {
            return n.doubleValue
        }
        return nil
    }

    private func normalizeTheme(_ raw: String) -> String? {
        switch raw {
        case "system", "light", "dark": return raw
        default: return nil
        }
    }

    private func extractCurrencyId(_ raw: String) -> String? {
        let parts = raw.split(separator: "&", maxSplits: 1, omittingEmptySubsequences: false)
        guard let first = parts.first, !first.isEmpty else { return nil }
        return String(first)
    }
}
