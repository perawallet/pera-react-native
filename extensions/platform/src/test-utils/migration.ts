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

import {
    LEGACY_MIGRATION_SCHEMA_VERSION,
    type LegacyMigrationData,
    type LegacyMigrationSourcePlatform,
    type MigrationSentinelValue,
    type MigrationService,
    type MigrationStepVersions,
} from '../migration'

export const createEmptyLegacyMigrationData = (
    sourcePlatform: LegacyMigrationSourcePlatform = 'android',
): LegacyMigrationData => ({
    schemaVersion: LEGACY_MIGRATION_SCHEMA_VERSION,
    sourcePlatform,
    preferences: {
        theme: null,
        currency: null,
        biometricEnabled: null,
        rekeySupport: null,
        privacyMode: null,
        arc59ExpressSendWarningEnabled: null,
        applicationOpenCount: null,
        lockAttemptCount: null,
        lockPenaltyRemainingMs: null,
        appAtBackgroundMs: null,
        notificationRefreshTimestampMs: null,
        assetFilterZeroBalance: null,
        assetFilterDisplayNFT: null,
        assetFilterDisplayOptedInNFT: null,
        collectibleFilterNotOwned: null,
        nftFilterDisplayWatchAccountNFTs: null,
        nftListingViewType: null,
        accountSortPreference: null,
        assetSortPreference: null,
        collectibleSortPreference: null,
        swapLastUsedAddress: null,
        swapUseLocalCurrency: null,
        swapSlippageTolerance: null,
        swapTermsAccepted: null,
        rawFlags: {},
    },
    auth: { pin: null },
    accounts: [],
    undecodableAccounts: [],
    hdWallets: [],
    contacts: [],
    notificationFilters: [],
    walletConnectV1: [],
    walletConnectV2: [],
    passkeys: [],
    deviceIdentifiers: {
        notificationUserId: null,
        mainnetDeviceId: null,
        testnetDeviceId: null,
        lastSeenNotificationId: null,
    },
    dismissedBanners: {
        bannerIds: [],
    },
    tooltipPreferences: {
        qrTooltipSeen: null,
        copyAddressTooltipSeen: null,
        copyAddressPromoSeen: null,
        transactionTutorialSeen: null,
        privacyModeTooltipSeen: null,
        jointAccountDisclaimerSeen: null,
        walletConnectWarningSeen: null,
        swapIntroSeen: null,
        giftCardsIntroSeen: null,
        ledgerPairingWarningSeen: null,
        transactionInfoDismissed: null,
        filterTutorialSeen: null,
        backupIntroSeen: null,
    },
})

export class StubMigrationService implements MigrationService {
    private data: LegacyMigrationData
    private hasData: boolean
    private sentinel: MigrationSentinelValue | null = null
    private stepVersions: MigrationStepVersions | null = null

    constructor(
        options: {
            data?: LegacyMigrationData
            hasData?: boolean
        } = {},
    ) {
        this.data = options.data ?? createEmptyLegacyMigrationData()
        this.hasData = options.hasData ?? false
    }

    async hasLegacyData(): Promise<boolean> {
        if (this.sentinel !== null) return false
        return this.hasData
    }

    async getLegacyData(): Promise<LegacyMigrationData> {
        return this.data
    }

    async isMigrationComplete(): Promise<boolean> {
        return this.sentinel !== null
    }

    async markMigrationComplete(
        sourcePlatform: LegacyMigrationSourcePlatform,
    ): Promise<void> {
        this.sentinel = { completedAt: Date.now(), sourcePlatform }
    }

    async clearMigrationComplete(): Promise<void> {
        this.sentinel = null
        this.stepVersions = null
    }

    async getMigrationPlans() {
        return []
    }

    async simulateLegacyDatabase() {}

    async simulatePreSixxAccounts() {}

    async resetLegacyData() {
        this.hasData = false
        this.sentinel = null
        this.stepVersions = null
    }

    async getCompletedStepVersions(): Promise<MigrationStepVersions | null> {
        return this.stepVersions
    }

    async setCompletedStepVersions(
        versions: MigrationStepVersions,
    ): Promise<void> {
        this.stepVersions = versions
    }

    get migrationSentinel(): MigrationSentinelValue | null {
        return this.sentinel
    }

    get migrationStepVersions(): MigrationStepVersions | null {
        return this.stepVersions
    }
}

export const createStubMigrationService = (
    options?: ConstructorParameters<typeof StubMigrationService>[0],
): StubMigrationService => new StubMigrationService(options)
