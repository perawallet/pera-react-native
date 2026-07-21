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

final class LegacyDataBuilder {

    private let resolver: AppGroupResolver
    private let keychain: KeychainReader

    init(
        resolver: AppGroupResolver = .shared,
        keychain: KeychainReader = KeychainReader()
    ) {
        self.resolver = resolver
        self.keychain = keychain
    }

    func build() throws -> [String: Any] {
        let resolved = resolver.resolve()

        var sqliteReader: SqliteReader?
        var userBlob: LegacyUserBlob.User?
        if let resolved = resolved {
            let reader = SqliteReader(storeURL: resolved.coreDataStoreURL)
            try reader.open()
            if let userBlobData = try reader.readAuthenticatedUserData() {
                userBlob = try Self.decodeUserBlob(userBlobData)
            }
            sqliteReader = reader
        }

        let defaultsReader = resolved.flatMap { UserDefaultsReader(suiteName: $0.appGroupId) }
        let prefs = defaultsReader?.read() ?? UserDefaultsReader.Preferences()
        let tooltips = defaultsReader?.readTooltips() ?? UserDefaultsReader.Tooltips()
        let dismissedBannerIds = defaultsReader?.readDismissedBannerIds() ?? []

        let accounts = userBlob?.accounts ?? []
        let walletNames = userBlob?.walletNames ?? [:]

        let contactRows: [SqliteReader.ContactRow]
        let passkeyRows: [SqliteReader.PasskeyRow]
        let wcHistoryBlob: Data?
        let wcSessionEntries: [SqliteReader.WCSessionListEntry]
        if let reader = sqliteReader {
            contactRows = (try? reader.readContacts()) ?? []
            passkeyRows = (try? reader.readPasskeys()) ?? []
            wcHistoryBlob = try? reader.readWalletConnectHistoryBlob()
            wcSessionEntries = reader.readWalletConnectV1Sessions()
        } else {
            contactRows = []
            passkeyRows = []
            wcHistoryBlob = nil
            wcSessionEntries = []
        }

        var out = BridgeMap()
        out.putInt("schemaVersion", LegacyMigrationConstants.schemaVersion)
        out.putString("sourcePlatform", LegacyMigrationConstants.sourcePlatform)
        out.putRaw("preferences", buildPreferences(prefs))
        out.putRaw("auth", buildAuth())
        out.putRaw("accounts", AccountsBuilder.compose(
            accounts: accounts,
            keychain: keychain
        ))
        out.putRaw("hdWallets", HdWalletsBuilder.compose(
            accounts: accounts,
            walletNames: walletNames,
            keychain: keychain
        ))
        out.putRaw("contacts", ContactsBuilder.compose(rows: contactRows))
        out.putRaw("notificationFilters", NotificationsBuilder.compose(accounts: accounts))
        out.putRaw("walletConnectV1", WalletConnectBuilder.composeV1Sessions(wcSessionEntries))
        out.putRaw("walletConnectV2", [Any]())
        out.putRaw("passkeys", PasskeysBuilder.compose(rows: passkeyRows))
        out.putRaw("walletConnectHistoryBlob", WalletConnectBuilder.composeHistoryBlob(wcHistoryBlob))
        out.putRaw("deviceIdentifiers", buildDeviceIdentifiers(userBlob: userBlob, prefs: prefs))
        out.putRaw("tooltipPreferences", buildTooltipPreferences(tooltips))
        out.putRaw("dismissedBanners", buildDismissedBanners(dismissedBannerIds))
        return out.dict
    }

    private func buildDismissedBanners(_ ids: [String]) -> [String: Any] {
        var m = BridgeMap()
        m.putRaw("bannerIds", ids)
        return m.dict
    }

    private func buildTooltipPreferences(_ t: UserDefaultsReader.Tooltips) -> [String: Any] {
        var m = BridgeMap()
        m.putBool("qrTooltipSeen", t.qrTooltipSeen)
        m.putBool("copyAddressTooltipSeen", t.copyAddressTooltipSeen)
        m.putBool("copyAddressPromoSeen", t.copyAddressPromoSeen)
        m.putBool("transactionTutorialSeen", t.transactionTutorialSeen)
        m.putBool("privacyModeTooltipSeen", t.privacyModeTooltipSeen)
        m.putBool("jointAccountDisclaimerSeen", t.jointAccountDisclaimerSeen)
        m.putBool("walletConnectWarningSeen", t.walletConnectWarningSeen)
        m.putBool("swapIntroSeen", t.swapIntroSeen)
        m.putBool("giftCardsIntroSeen", t.giftCardsIntroSeen)
        m.putBool("ledgerPairingWarningSeen", t.ledgerPairingWarningSeen)
        m.putBool("transactionInfoDismissed", t.transactionInfoDismissed)
        return m.dict
    }

    private func buildPreferences(_ p: UserDefaultsReader.Preferences) -> [String: Any] {
        var m = BridgeMap()
        m.putString("theme", p.theme)
        m.putString("currency", p.currency)
        m.putInt("termsAcceptedVersion", p.termsAcceptedVersion)

        let biometric = (try? keychain.readBiometricEnabled()) ?? false
        m.putBool("biometricEnabled", biometric)

        m.putBool("privacyMode", p.privacyMode)
        m.putInt("lockAttemptCount", p.lockAttemptCount)
        m.putLongString("lockPenaltyRemainingMs", p.lockPenaltyRemainingMs)
        m.putLongString("notificationRefreshTimestampMs", p.notificationRefreshTimestampMs)
        m.putInt("copyAddressCount", p.copyAddressCount)

        m.putBool("assetFilterZeroBalance", p.assetFilterZeroBalance)
        m.putBool("assetFilterDisplayNFT", p.assetFilterDisplayNFT)
        m.putBool("assetFilterDisplayOptedInNFT", p.assetFilterDisplayOptedInNFT)
        m.putBool("collectibleFilterNotOwned", p.collectibleFilterNotOwned)
        m.putBool("nftFilterDisplayWatchAccountNFTs", p.nftFilterDisplayWatchAccountNFTs)
        m.putString("nftListingViewType", p.nftListingViewType)

        m.putString("accountSortPreference", PreferencesNormalizer.accountSort(
            p.accountSortRawDisplayName
        ))
        m.putString("assetSortPreference", PreferencesNormalizer.assetSort(
            p.assetSortRawDisplayName
        ))
        m.putString("collectibleSortPreference", PreferencesNormalizer.collectibleSort(
            p.collectibleSortRawDisplayName
        ))

        m.putString("swapLastUsedAddress", p.swapLastUsedAddress)
        m.putBool("swapUseLocalCurrency", p.swapUseLocalCurrency)
        m.putRaw("swapSlippageTolerance", NSNull())
        m.putBool("swapTermsAccepted", p.swapTermsAccepted)

        m.putBool("pinSetupPromptDismissed", p.pinSetupPromptDismissed)

        m.putRaw("rawFlags", p.rawFlags)
        return m.dict
    }

    private func buildAuth() -> [String: Any] {
        var m = BridgeMap()
        let pin = try? keychain.readPin()
        m.putBytes("pin", pin)
        return m.dict
    }

    private func buildDeviceIdentifiers(
        userBlob: LegacyUserBlob.User?,
        prefs: UserDefaultsReader.Preferences
    ) -> [String: Any] {
        var m = BridgeMap()
        m.putString("notificationUserId", userBlob?.notificationUserId)
        m.putString("mainnetDeviceId", userBlob?.deviceIDOnMainnet)
        m.putString("testnetDeviceId", userBlob?.deviceIDOnTestnet)
        m.putLongString("lastSeenNotificationId", prefs.lastSeenNotificationId)
        m.putString("legacyFallbackDeviceId", userBlob?.deviceId)
        return m.dict
    }

    private static func decodeUserBlob(_ data: Data) throws -> LegacyUserBlob.User {
        do {
            return try JSONDecoder().decode(LegacyUserBlob.User.self, from: data)
        } catch {
            throw LegacyMigrationError.decode(
                "User blob JSON decode failed: \(error.localizedDescription)"
            )
        }
    }
}

enum PreferencesNormalizer {

    static func accountSort(_ raw: String?) -> String? {
        guard let raw = raw else { return nil }
        switch raw {
        case "Manually":                  return "manual"
        case "Alphabetically A to Z":     return "alphabeticalAsc"
        case "Alphabetically Z to A":     return "alphabeticalDesc"
        case "Lowest Value to Highest":   return "balanceAsc"
        case "Highest Value to Lowest":   return "balanceDesc"
        default:                          return nil
        }
    }

    static func assetSort(_ raw: String?) -> String? {
        guard let raw = raw else { return nil }
        switch raw {
        case "Alphabetically A to Z":     return "alphabeticalAsc"
        case "Alphabetically Z to A":     return "alphabeticalDesc"
        case "Lowest Value to Highest":   return "balanceAsc"
        case "Highest Value to Lowest":   return "balanceDesc"
        default:                          return nil
        }
    }

    static func collectibleSort(_ raw: String?) -> String? {
        guard let raw = raw else { return nil }
        switch raw {
        case "Alphabetically A to Z":     return "titleAsc"
        case "Alphabetically Z to A":     return "titleDesc"
        case "Oldest to Newest":          return "oldestFirst"
        case "Newest to Oldest":          return "newestFirst"
        default:                          return nil
        }
    }
}
