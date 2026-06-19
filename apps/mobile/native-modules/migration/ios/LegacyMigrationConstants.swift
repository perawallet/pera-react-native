/*
 Copyright 2022-2025 Pera Wallet, LDA
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

enum LegacyMigrationConstants {
    static let schemaVersion: Int = 1

    static let sourcePlatform: String = "ios"

    static let logTag: String = "LegacyMigration"

    static let legacyAppGroupByBundleId: [String: String] = [
        "com.algorandllc.algorand":       "group.com.algorandllc.algorand",
        "com.peralda.perawallet.staging": "group.com.peralda.perawallet.staging",
        "com.peralda.perawallet.beta":    "group.com.peralda.perawallet.beta",
    ]

    static let coreDataStoreFilename: String = "algorand.sqlite"

    static let simulatorStoreName: String = "ios_legacy_store"
    static let simulatorVersion: Int = 1

    enum KeychainService {
        static let tokenPrivate = "com.algorand.algorand.token.private"
        static let hdwallet = "com.algorand.algorand.hdwallet"
        static let biometricStorage = "com.algorand.algorand.biometric.storage"
    }

    enum KeychainAccount {
        static let pinCode = "pera.pinCode"
        static let biometricFlag = "com.algorand.algorand.biometric.authentication"
        static let privateKeyPrefix = "com.algorand.algorand.token.private.key."
        static let hdWalletPrefix = "wallet."
        static let hdAddressPrefix = "address."
    }

    enum DefaultsKey {
        static let theme = "com.algorand.algorand.interface.preference"
        static let currency = "com.algorand.algorand.currency.preference"
        static let termsAcceptedV2 = "com.algorand.algorand.terms.services.v2"
        static let appReviewStartCount = "review.condition.value"
        static let lastVersionReviewed = "last.version.reviewed"
        static let storeAppIsOnboarding = "com.algorand.store.app.isOnboarding"
        static let localAuthenticationStatus = "com.algorand.algorand.local.authentication.status"
        static let announcementState = "com.algorand.algorand.announcement.state"
        static let termsServicesV1 = "com.algorand.algorand.terms.services"
        static let secureBackups = "com.algorand.algorand.secure.backups"
        static let watchedJointAccountInvitations = "watchedJointAccountInvitations"
        static let watchedSignRequestMessage = "watchedSignRequestMessage"
        static let lockAttemptCount = "com.algorand.algorand.pin.limit.attempt.key"
        static let lockPenaltyRemainingSec = "com.algorand.algorand.pin.limit.remaining.time"
        static let notificationRefreshTimestampSec = "com.algorand.algorand.notification.latest.timestamp"
        static let copyAddressCount = "com.algorand.algorand.copy.address.count.key"
        static let lastSeenNotificationId = "com.algorand.algorand.lastseen.notification.id"
        static let privacyMode = "isPrivacyModeEnabled"
        static let assetFilterZeroBalance = "cache.key.hideAssetsWithNoBalanceInAssetList"
        static let assetFilterDisplayNFT = "cache.key.displayCollectibleAssetsInAssetList"
        static let assetFilterDisplayOptedInNFT = "cache.key.displayOptedInCollectibleAssetsInAssetList"
        static let nftFilterDisplayWatchAccountNFTs = "cache.key.displayWatchAccountCollectibleAssetsInCollectibleList"
        static let collectibleFilterNotOwned = "cache.key.collectibleListFilter"
        static let nftListingViewType = "cache.key.collectibleGalleryUIStyle"
        static let accountSort = "cache.key.accountSortingAlgorithmName"
        static let assetSort = "cache.key.accountAssetSortingAlgorithmNameKey"
        static let collectibleSort = "cache.key.collectibleSortingAlgorithmName"
        static let swapTermsAccepted = "cache.key.swap.isConfirmedUserAgreement"
        static let swapLastUsedAddress = "lastAddressUsedInSwapCompleted"
        static let swapUseLocalCurrency = "shouldUseLocalCurrencyInSwap"

        static let tooltipQr = "com.algorand.algorand.accounts.qr.tooltip"
        static let tooltipCopyAddress = "cache.key.transactionDetailIsDisplayedCopyAddressTooltip"
        static let tooltipCopyAddressPromo = "promotion.dialog.copyAddress"
        static let tooltipTransactionTutorial = "com.algorand.algorand.transaction.tutorial"
        static let tooltipPrivacyMode = "wasPrivacyTooltipPresented"
        static let tooltipJointAccountDisclaimer = "hasJointAccountCreationPopupBeenShown"
        static let tooltipWalletConnectWarning = "com.algorand.algorand.wc.warning.displayed"
        static let tooltipSwapIntro = "promotion.dialog.swap"
        static let tooltipGiftCardsIntro = "promotion.dialog.buyGiftCardsWithCrypto"
        static let tooltipLedgerPairingWarning = "com.algorand.algorand.ledger.pairing.warning.displayed"
        static let tooltipTransactionInfoDismissed = "com.algorand.algorand.transaction.info.dont.ask.again"

        static let passcodeDontAskAgain = "com.algorand.algorand.passcode.dont.ask.again"
        static let passcodeAppCount = "com.algorand.algorand.passcode.app.count.key"
    }

    enum ErrorCode {
        static let getLegacyData = "E_GET_LEGACY_DATA"
        static let simulate = "E_SIMULATE_LEGACY_DATABASE"
        static let reset = "E_RESET_LEGACY_DATA"
    }
}
