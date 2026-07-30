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
    /** ⚠️ DEV-ONLY: materializes a populated legacy DB — never call from app code. */
    simulateLegacyDatabase(args: SimulateLegacyDatabaseArgs): Promise<void>
    /** ⚠️ DEV-ONLY: writes the pre-6.x encrypted account blob — never call from app code. */
    simulatePreSixxAccounts(): Promise<void>
    /** Removes all legacy (v6) migration data and clears the migration sentinel. */
    resetLegacyData(): Promise<void>
    /** Returns the per-step version record, or `null` when no record has ever been written. */
    getCompletedStepVersions(): Promise<MigrationStepVersions | null>
    /** Persists the per-step version record. */
    setCompletedStepVersions(versions: MigrationStepVersions): Promise<void>
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
    hdWallets: LegacyHDWallet[]
    contacts: LegacyContact[]
    notificationFilters: string[]
    walletConnectV1: LegacyWalletConnectV1Session[]
    walletConnectV2: LegacyWalletConnectV2Session[]
    walletConnectHistoryBlob?: string | null
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
    qrTooltipSeen: boolean | null
    copyAddressTooltipSeen: boolean | null
    copyAddressPromoSeen: boolean | null
    transactionTutorialSeen: boolean | null
    privacyModeTooltipSeen: boolean | null
    jointAccountDisclaimerSeen: boolean | null
    walletConnectWarningSeen: boolean | null
    swapIntroSeen: boolean | null
    giftCardsIntroSeen: boolean | null
    ledgerPairingWarningSeen: boolean | null
    transactionInfoDismissed: boolean | null
    filterTutorialSeen: boolean | null
    backupIntroSeen: boolean | null
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
    theme: LegacyTheme | null
    currency: string | null
    termsAcceptedVersion?: number | null

    biometricEnabled: boolean | null
    rekeySupport: boolean | null
    privacyMode: boolean | null
    arc59ExpressSendWarningEnabled: boolean | null

    applicationOpenCount: number | null
    lockAttemptCount: number | null
    lockPenaltyRemainingMs: number | null
    appAtBackgroundMs: number | null
    notificationRefreshTimestampMs: number | null
    copyAddressCount?: number | null

    assetFilterZeroBalance: boolean | null
    assetFilterDisplayNFT: boolean | null
    assetFilterDisplayOptedInNFT: boolean | null
    collectibleFilterNotOwned: boolean | null
    nftFilterDisplayWatchAccountNFTs: boolean | null
    nftListingViewType: LegacyGalleryLayout | null

    accountSortPreference: LegacyAccountSort | null
    assetSortPreference: LegacyAssetSort | null
    collectibleSortPreference: LegacyCollectibleSort | null

    swapLastUsedAddress: string | null
    swapUseLocalCurrency: boolean | null
    swapSlippageTolerance: number | null
    swapTermsAccepted: boolean | null

    pinSetupPromptDismissed?: boolean | null

    rawFlags: Record<string, LegacyRawFlagValue>
}

export type LegacyRawFlagValue = string | number | boolean | null

export interface LegacyAuth {
    pin: Uint8Array | null
}

export type LegacyAccountType = 'standard' | 'ledger' | 'watch' | 'joint'

export interface LegacyAccount {
    address: string
    name: string
    type: LegacyAccountType

    preferredOrder: number
    isBackedUp: boolean

    secretKey: Uint8Array | null

    hdWalletId: string | null

    ledger: LegacyLedgerAccountDetails | null

    joint: LegacyJointAccountDetails | null

    /**
     * On-chain auth address Pera 6 had recorded for this account (rekey
     * target), when the legacy store carried one. Null when unknown — the
     * account syncer self-heals from chain state either way.
     */
    authAddress: string | null
}

export interface LegacyLedgerAccountDetails {
    bluetoothAddress: string
    bluetoothName: string | null
    positionInLedger: number
}

export interface LegacyJointAccountDetails {
    threshold: number | null
    version: number
    participants: string[]
}

export interface LegacyHDWallet {
    walletId: string
    name: string | null
    entropy: Uint8Array | null
    keys: LegacyHDKey[]
}

export interface LegacyHDKey {
    address: string
    account: number
    change: number
    keyIndex: number
    derivationType: number
    privateKey: Uint8Array | null
}

export interface LegacyContact {
    name: string
    address: string
    avatar: string | null
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
    fallbackBrowserGroupResponse: string | null
    connectedAccounts: string[]
    sessionMetaJson: string
    clientId: string | null
    peerId: string | null
    handshakeId: number | null
    currentKey: string | null
    approvedAccounts: string[] | null
    chainId: number | null
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
    fallbackBrowserGroupResponse: string | null
}

export interface LegacyPasskey {
    credentialId: string
    address: string
    siteUrl: string
    siteName: string | null
    userName: string | null
    userDisplayName: string | null
    userHandle?: string | null
    lastUsedAtMs: number | null
}

export interface LegacyDeviceIdentifiers {
    notificationUserId: string | null
    mainnetDeviceId: string | null
    testnetDeviceId: string | null
    lastSeenNotificationId: number | null
    /**
     * Pre-per-network single device id (iOS: `User.deviceId`; Android:
     * `notification_user_id`, mirroring Pera 6's own promotion of it to
     * `mainnet_device_id`). Used by `migrateDeviceIdentifiers` as a mainnet
     * fallback only when `mainnetDeviceId` is null.
     */
    legacyFallbackDeviceId: string | null
}
