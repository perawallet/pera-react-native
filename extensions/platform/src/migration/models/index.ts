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

import type { Nullable } from '@perawallet/wallet-core-shared'

export const LEGACY_MIGRATION_SCHEMA_VERSION = 1

export const MIGRATION_SENTINEL_KEY = 'legacy-migration-v1-complete'

export const MIGRATION_STEPS_KEY = 'legacy-migration-steps'

export type LegacyMigrationSourcePlatform = 'android' | 'ios'

export interface MigrationSentinelValue {
    completedAt: number
    sourcePlatform: LegacyMigrationSourcePlatform
}

export type MigrationStepName =
    | 'accounts'
    | 'preferences'
    | 'swaps'
    | 'deviceIdentifiers'
    | 'contacts'
    | 'notifications'
    | 'auth'
    | 'walletConnect'
    | 'passkeys'
    | 'stashed'

export type MigrationStepVersions = Partial<Record<MigrationStepName, number>>

export interface MigrationService {
    hasLegacyData(): Promise<boolean>
    getLegacyData(): Promise<LegacyMigrationData>
    isMigrationComplete(): Promise<boolean>
    markMigrationComplete(
        sourcePlatform: LegacyMigrationSourcePlatform,
    ): Promise<void>
    clearMigrationComplete(): Promise<void>
    getMigrationPlans(): Promise<MigrationPlanSummary[]>
    /**
     * ⚠️ DEV-ONLY fixture writers for the developer migration simulator — never
     * call from app code. Absent where there is no legacy store to write (web).
     */
    readonly devTools?: MigrationDevTools
    /** Removes all legacy (v6) migration data and clears the migration sentinel. */
    resetLegacyData(): Promise<void>
    /** Returns the per-step version record, or `null` when no record has ever been written. */
    getCompletedStepVersions(): Promise<Nullable<MigrationStepVersions>>
    /** Persists the per-step version record. */
    setCompletedStepVersions(versions: MigrationStepVersions): Promise<void>
}

export interface MigrationDevTools {
    /** Materializes a populated legacy DB and clears the migration sentinel. */
    simulateLegacyDatabase(args: SimulateLegacyDatabaseArgs): Promise<void>
    /** Writes the pre-6.x encrypted account blob and clears the migration sentinel. */
    simulatePreSixxAccounts(): Promise<void>
}

export interface SimulateLegacyDatabaseArgs {
    dbName: string
    version: number
    profile?: string
    includeUnroutableAccounts?: boolean
    includeAuthState?: boolean
}

export interface MigrationPlanSummary {
    dbName: string
    targetVersion: number
    oldestSupported: number
    readerImpact: string
    migrations: BundledMigrationSummary[]
}

export interface BundledMigrationSummary {
    from: number
    to: number
    description: string
}

export interface LegacyMigrationData {
    schemaVersion: number
    sourcePlatform: LegacyMigrationSourcePlatform

    preferences: LegacyPreferences
    auth: LegacyAuth
    accounts: LegacyAccount[]
    hdSeeds: LegacyHDWallet[]
    contacts: LegacyContact[]
    notificationFilters: string[]
    walletConnectV1: LegacyWalletConnectV1Session[]
    walletConnectV2: LegacyWalletConnectV2Session[]
    walletConnectHistoryBlob?: Nullable<string>
    passkeys: LegacyPasskey[]
    deviceIdentifiers: LegacyDeviceIdentifiers
    tooltipPreferences: LegacyTooltipPreferences
    dismissedBanners: LegacyDismissedBanners
    schemaReplayResults?: Record<string, LegacySchemaReplayResult>
    undecodableAccounts: LegacyUndecodableAccount[]
}

export interface LegacyUndecodableAccount {
    address: string
    name: string
    error: string
}

export type LegacySchemaReplayResult =
    | { kind: 'missing' }
    | { kind: 'notNeeded'; currentVersion: number }
    | { kind: 'ahead'; currentVersion: number }
    | { kind: 'replayed'; fromVersion: number; toVersion: number }
    | { kind: 'tooOld'; currentVersion: number; oldestSupported: number }
    | { kind: 'failed'; partialVersion: number; errorMessage: string }

export interface LegacyDismissedBanners {
    bannerIds: string[]
}

export interface LegacyTooltipPreferences {
    qrTooltipSeen: Nullable<boolean>
    copyAddressTooltipSeen: Nullable<boolean>
    copyAddressPromoSeen: Nullable<boolean>
    transactionTutorialSeen: Nullable<boolean>
    privacyModeTooltipSeen: Nullable<boolean>
    jointAccountDisclaimerSeen: Nullable<boolean>
    walletConnectWarningSeen: Nullable<boolean>
    swapIntroSeen: Nullable<boolean>
    giftCardsIntroSeen: Nullable<boolean>
    ledgerPairingWarningSeen: Nullable<boolean>
    transactionInfoDismissed: Nullable<boolean>
    filterTutorialSeen: Nullable<boolean>
    backupIntroSeen: Nullable<boolean>
}

export type LegacyTheme = 'system' | 'light' | 'dark'

export type LegacyAccountSort =
    | 'manual'
    | 'alphabeticalAsc'
    | 'alphabeticalDesc'
    | 'balanceAsc'
    | 'balanceDesc'

export type LegacyAssetSort =
    | 'alphabeticalAsc'
    | 'alphabeticalDesc'
    | 'balanceAsc'
    | 'balanceDesc'

export type LegacyCollectibleSort =
    | 'titleAsc'
    | 'titleDesc'
    | 'newestFirst'
    | 'oldestFirst'

export type LegacyGalleryLayout = 'grid' | 'list'

export interface LegacyPreferences {
    theme: Nullable<LegacyTheme>
    currency: Nullable<string>
    termsAcceptedVersion?: Nullable<number>

    biometricEnabled: Nullable<boolean>
    rekeySupport: Nullable<boolean>
    privacyMode: Nullable<boolean>
    arc59ExpressSendWarningEnabled: Nullable<boolean>

    applicationOpenCount: Nullable<number>
    lockAttemptCount: Nullable<number>
    lockPenaltyRemainingMs: Nullable<number>
    appAtBackgroundMs: Nullable<number>
    notificationRefreshTimestampMs: Nullable<number>
    copyAddressCount?: Nullable<number>

    assetFilterZeroBalance: Nullable<boolean>
    assetFilterDisplayNFT: Nullable<boolean>
    assetFilterDisplayOptedInNFT: Nullable<boolean>
    collectibleFilterNotOwned: Nullable<boolean>
    nftFilterDisplayWatchAccountNFTs: Nullable<boolean>
    nftListingViewType: Nullable<LegacyGalleryLayout>

    accountSortPreference: Nullable<LegacyAccountSort>
    assetSortPreference: Nullable<LegacyAssetSort>
    collectibleSortPreference: Nullable<LegacyCollectibleSort>

    swapLastUsedAddress: Nullable<string>
    swapUseLocalCurrency: Nullable<boolean>
    swapSlippageTolerance: Nullable<number>
    swapTermsAccepted: Nullable<boolean>

    pinSetupPromptDismissed?: Nullable<boolean>

    rawFlags: Record<string, LegacyRawFlagValue>
}

export type LegacyRawFlagValue = string | number | boolean | null

export interface LegacyAuth {
    pin: Nullable<Uint8Array>
}

export type LegacyAccountType = 'standard' | 'ledger' | 'watch' | 'joint'

export interface LegacyAccount {
    address: string
    name: string
    type: LegacyAccountType

    preferredOrder: number
    isBackedUp: boolean

    secretKey: Nullable<Uint8Array>

    hdSeedId: Nullable<string>

    ledger: Nullable<LegacyLedgerAccountDetails>

    joint: Nullable<LegacyJointAccountDetails>

    /**
     * On-chain auth address Pera 6 had recorded for this account (rekey
     * target), when the legacy store carried one. Null when unknown — the
     * account syncer self-heals from chain state either way.
     */
    authAddress: Nullable<string>
}

export interface LegacyLedgerAccountDetails {
    bluetoothAddress: string
    bluetoothName: Nullable<string>
    positionInLedger: number
}

export interface LegacyJointAccountDetails {
    threshold: Nullable<number>
    version: number
    participants: string[]
}

export interface LegacyHDWallet {
    walletId: string
    name: Nullable<string>
    entropy: Nullable<Uint8Array>
    keys: LegacyHDKey[]
}

export interface LegacyHDKey {
    address: string
    account: number
    change: number
    keyIndex: number
    derivationType: number
    privateKey: Nullable<Uint8Array>
}

export interface LegacyContact {
    name: string
    address: string
    avatar: Nullable<string>
}

export interface LegacyWalletConnectPeerMeta {
    name: string
    url: string
    icons: string[]
    description: string
}

export interface LegacyWalletConnectV1Session {
    id: string
    peerMeta: LegacyWalletConnectPeerMeta
    isConnected: boolean
    isSubscribed: boolean
    dateTimestampMs: number
    fallbackBrowserGroupResponse: Nullable<string>
    connectedAccounts: string[]
    sessionMetaJson: string
    clientId: Nullable<string>
    peerId: Nullable<string>
    handshakeId: Nullable<number>
    currentKey: Nullable<string>
    approvedAccounts: Nullable<string[]>
    chainId: Nullable<number>
}

/**
 * Decoded for diagnostics only (payload summary log + developer migration
 * viewer counts) — deliberately consumed by no migrator. Pera 6 persists
 * just this bookkeeping row; everything required to rehydrate a working
 * WC v2 session (per-topic symmetric key from the SDK's crypto keychain,
 * self/peer keys and metadata, approved namespaces, relay, expiry) lives in
 * the WalletConnect SDK's own platform-encrypted storage and never reaches
 * the export (iOS exports an empty array). Pera RN also has no WC v2 client
 * to import into (packages/walletconnect is v1-only), so v2 sessions are
 * throwaway: users re-pair after migration.
 */
export interface LegacyWalletConnectV2Session {
    topic: string
    dateTimestampMs: number
    isSubscribed: boolean
    fallbackBrowserGroupResponse: Nullable<string>
}

export interface LegacyPasskey {
    credentialId: string
    address: string
    siteUrl: string
    siteName: Nullable<string>
    userName: Nullable<string>
    userDisplayName: Nullable<string>
    userHandle?: Nullable<string>
    lastUsedAtMs: Nullable<number>
}

export interface LegacyDeviceIdentifiers {
    notificationUserId: Nullable<string>
    mainnetDeviceId: Nullable<string>
    testnetDeviceId: Nullable<string>
    lastSeenNotificationId: Nullable<number>
    /**
     * Pre-per-network single device id (iOS: `User.deviceId`; Android:
     * `notification_user_id`, mirroring Pera 6's own promotion of it to
     * `mainnet_device_id`). Used by `migrateDeviceIdentifiers` as a mainnet
     * fallback only when `mainnetDeviceId` is null.
     */
    legacyFallbackDeviceId: Nullable<string>
}
