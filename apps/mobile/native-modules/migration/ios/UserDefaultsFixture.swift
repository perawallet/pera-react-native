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

enum UserDefaultsFixture {

    private typealias Keys = LegacyMigrationConstants.DefaultsKey

    static func generate(suiteName: String, includeAuthState: Bool) {
        guard let defaults = UserDefaults(suiteName: suiteName) else { return }

        defaults.set("light", forKey: Keys.theme)
        defaults.set("USD&ALGO", forKey: Keys.currency)
        defaults.set(true, forKey: Keys.termsAcceptedV2)

        defaults.set(true, forKey: Keys.privacyMode)
        if includeAuthState {
            defaults.set(2, forKey: Keys.lockAttemptCount)
            defaults.set(30.0, forKey: Keys.lockPenaltyRemainingSec)
        }
        defaults.set(1_704_067_200.0, forKey: Keys.notificationRefreshTimestampSec)
        defaults.set(5, forKey: Keys.copyAddressCount)
        defaults.set(123_456, forKey: Keys.lastSeenNotificationId)

        defaults.set(true, forKey: Keys.assetFilterZeroBalance)
        defaults.set(true, forKey: Keys.assetFilterDisplayNFT)
        defaults.set(false, forKey: Keys.assetFilterDisplayOptedInNFT)
        defaults.set(true, forKey: Keys.nftFilterDisplayWatchAccountNFTs)
        defaults.set(0, forKey: Keys.collectibleFilterNotOwned)
        defaults.set(1, forKey: Keys.nftListingViewType)

        defaults.set("Alphabetically A to Z", forKey: Keys.accountSort)
        defaults.set("Highest Value to Lowest", forKey: Keys.assetSort)
        defaults.set("Newest to Oldest", forKey: Keys.collectibleSort)

        defaults.set(true, forKey: Keys.swapTermsAccepted)
        defaults.set(FixtureIdentities.algo25ValidAddress, forKey: Keys.swapLastUsedAddress)
        defaults.set(true, forKey: Keys.swapUseLocalCurrency)

        defaults.set(true, forKey: Keys.passcodeDontAskAgain)

        for key in tooltipKeys {
            defaults.set(true, forKey: key)
        }

        if let data = try? JSONSerialization.data(withJSONObject: [
            "banner-dismissed": ["isHidden": true],
            "banner-active": ["isHidden": false],
        ]) {
            defaults.set(data, forKey: Keys.announcementState)
        }

        defaults.set("custom-value", forKey: "com.algorand.algorand.simulator.custom.flag")
        defaults.set(7, forKey: "com.algorand.algorand.simulator.counter")
    }

    private static let tooltipKeys: [String] = [
        Keys.tooltipQr,
        Keys.tooltipCopyAddress,
        Keys.tooltipCopyAddressPromo,
        Keys.tooltipTransactionTutorial,
        Keys.tooltipPrivacyMode,
        Keys.tooltipJointAccountDisclaimer,
        Keys.tooltipWalletConnectWarning,
        Keys.tooltipSwapIntro,
        Keys.tooltipGiftCardsIntro,
        Keys.tooltipLedgerPairingWarning,
        Keys.tooltipTransactionInfoDismissed,
    ]
}
