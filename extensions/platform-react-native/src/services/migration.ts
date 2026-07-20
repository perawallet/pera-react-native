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

import { Platform } from 'react-native'
import { requireOptionalNativeModule } from 'expo'
import {
    decodeFromBase64,
    decodeLongString,
    logger,
} from '@perawallet/wallet-core-shared'
import {
    type KeyValueStorageService,
    LEGACY_MIGRATION_SCHEMA_VERSION,
    type LegacyAccount,
    type LegacyHDKey,
    type LegacyHDWallet,
    type LegacyMigrationData,
    type LegacyMigrationSourcePlatform,
    type LegacyPasskey,
    type LegacyUndecodableAccount,
    type LegacyWalletConnectV1Session,
    type LegacyWalletConnectV2Session,
    MIGRATION_SENTINEL_KEY,
    MIGRATION_STEPS_KEY,
    type MigrationPlanSummary,
    type MigrationSentinelValue,
    type MigrationService,
    type MigrationStepVersions,
    type SimulateLegacyDatabaseArgs,
} from '@perawallet/wallet-extension-platform'

export class RNMigrationService implements MigrationService {
    constructor(private readonly keyValueStorage: KeyValueStorageService) {}

    async hasLegacyData(): Promise<boolean> {
        log('hasLegacyData() called')
        const sentinel = this.readSentinel()
        if (sentinel !== null) {
            log('hasLegacyData() → false (sentinel already set)', {
                completedAt: new Date(sentinel.completedAt).toISOString(),
                sourcePlatform: sentinel.sourcePlatform,
            })
            return false
        }
        const module = getNativeModule()
        if (!module) {
            warn(
                'hasLegacyData() → false (native LegacyMigration module is not registered)',
            )
            return false
        }
        try {
            const present = await module.hasLegacyData()
            log(`hasLegacyData() → ${present} (from native module)`)
            return present
        } catch (err) {
            error('hasLegacyData() native call threw', err)
            throw err
        }
    }

    async getLegacyData(): Promise<LegacyMigrationData> {
        log('getLegacyData() called')
        const module = getNativeModule()
        if (!module) {
            warn(
                'getLegacyData() → empty payload (native LegacyMigration module is not registered)',
            )
            return emptyLegacyMigrationData()
        }
        let raw: RawLegacyMigrationData
        try {
            raw = (await module.getLegacyData()) as RawLegacyMigrationData
        } catch (err) {
            error('getLegacyData() native call threw', err)
            throw err
        }
        log('getLegacyData() native payload received; decoding')
        const decoded = decodeLegacyMigrationData(raw)
        log('getLegacyData() decoded', summarizeLegacyData(decoded))
        return decoded
    }

    async isMigrationComplete(): Promise<boolean> {
        const sentinel = this.readSentinel()
        const result = sentinel !== null
        log(
            `isMigrationComplete() → ${result}`,
            sentinel
                ? {
                      completedAt: new Date(sentinel.completedAt).toISOString(),
                      sourcePlatform: sentinel.sourcePlatform,
                  }
                : undefined,
        )
        return result
    }

    async markMigrationComplete(
        sourcePlatform: LegacyMigrationSourcePlatform,
    ): Promise<void> {
        const value: MigrationSentinelValue = {
            completedAt: Date.now(),
            sourcePlatform,
        }
        log('markMigrationComplete() writing sentinel', {
            sourcePlatform,
            completedAt: new Date(value.completedAt).toISOString(),
        })
        this.keyValueStorage.setItem(
            MIGRATION_SENTINEL_KEY,
            JSON.stringify(value),
        )
    }

    async clearMigrationComplete(): Promise<void> {
        log('clearMigrationComplete() removing sentinel')
        this.keyValueStorage.removeItem(MIGRATION_SENTINEL_KEY)
        this.keyValueStorage.removeItem(MIGRATION_STEPS_KEY)
    }

    async getMigrationPlans(): Promise<MigrationPlanSummary[]> {
        const module = getNativeModule()
        if (!module || typeof module.getMigrationPlans !== 'function') {
            return []
        }
        const raw = await module.getMigrationPlans()
        return raw as MigrationPlanSummary[]
    }

    async simulateLegacyDatabase(
        args: SimulateLegacyDatabaseArgs,
    ): Promise<void> {
        const module = getNativeModule()
        if (!module || typeof module.simulateLegacyDatabase !== 'function') {
            return
        }
        await module.simulateLegacyDatabase(args)
        this.keyValueStorage.removeItem(MIGRATION_SENTINEL_KEY)
    }

    async simulatePreSixxAccounts(): Promise<void> {
        const module = getNativeModule()
        if (!module || typeof module.simulatePreSixxAccounts !== 'function') {
            return
        }
        await module.simulatePreSixxAccounts()
        this.keyValueStorage.removeItem(MIGRATION_SENTINEL_KEY)
    }

    async resetLegacyData(): Promise<void> {
        const module = getNativeModule()
        if (!module || typeof module.resetLegacyData !== 'function') {
            return
        }
        await module.resetLegacyData()
        this.keyValueStorage.removeItem(MIGRATION_SENTINEL_KEY)
        this.keyValueStorage.removeItem(MIGRATION_STEPS_KEY)
    }

    async getCompletedStepVersions(): Promise<MigrationStepVersions | null> {
        const raw = this.keyValueStorage.getItem(MIGRATION_STEPS_KEY)
        if (!raw) return null
        try {
            const parsed = JSON.parse(raw) as unknown
            if (typeof parsed !== 'object' || parsed === null) {
                warn('getCompletedStepVersions() ignored malformed record', {
                    raw,
                })
                return null
            }
            return parsed as MigrationStepVersions
        } catch {
            warn('getCompletedStepVersions() ignored non-JSON record', {
                raw,
            })
            return null
        }
    }

    async setCompletedStepVersions(
        versions: MigrationStepVersions,
    ): Promise<void> {
        this.keyValueStorage.setItem(
            MIGRATION_STEPS_KEY,
            JSON.stringify(versions),
        )
    }

    private readSentinel(): MigrationSentinelValue | null {
        const raw = this.keyValueStorage.getItem(MIGRATION_SENTINEL_KEY)
        if (!raw) return null
        try {
            const parsed = JSON.parse(raw) as MigrationSentinelValue
            if (
                parsed.sourcePlatform !== 'android' &&
                parsed.sourcePlatform !== 'ios'
            ) {
                warn('readSentinel() ignored malformed sentinel value', {
                    raw,
                })
                return null
            }
            return parsed
        } catch {
            warn('readSentinel() ignored non-JSON sentinel value', { raw })
            return null
        }
    }
}

const LOG_TAG = '[Migration]'

const log = (message: string, context?: Record<string, unknown>): void => {
    logger.info(`${LOG_TAG} ${message}`, context)
}

const warn = (message: string, context?: Record<string, unknown>): void => {
    logger.warn(`${LOG_TAG} ${message}`, context)
}

const error = (message: string, err: unknown): void => {
    logger.error(`${LOG_TAG} ${message}`, { error: err })
}

// Log summary — must never include secrets (keys, PIN, entropy, contact images).
const summarizeLegacyData = (
    data: LegacyMigrationData,
): Record<string, unknown> => ({
    schemaVersion: data.schemaVersion,
    sourcePlatform: data.sourcePlatform,
    accounts: data.accounts.length,
    accountsWithSecretKey: data.accounts.filter(a => a.secretKey !== null)
        .length,
    accountsWithHDWallet: data.accounts.filter(a => a.hdWalletId !== null)
        .length,
    accountsWithLedger: data.accounts.filter(a => a.ledger !== null).length,
    accountsWithJoint: data.accounts.filter(a => a.joint !== null).length,
    hdWallets: data.hdWallets.length,
    contacts: data.contacts.length,
    notificationFilters: data.notificationFilters.length,
    walletConnectV1: data.walletConnectV1.length,
    walletConnectV2: data.walletConnectV2.length,
    passkeys: data.passkeys.length,
    hasPin: data.auth.pin !== null,
    hasWalletConnectHistoryBlob: data.walletConnectHistoryBlob != null,
})

interface NativeLegacyMigrationModule {
    hasLegacyData(): Promise<boolean>

    getLegacyData(): Promise<unknown>

    getMigrationPlans?(): Promise<unknown>

    simulateLegacyDatabase?(args: SimulateLegacyDatabaseArgs): Promise<void>

    simulatePreSixxAccounts?(): Promise<void>

    resetLegacyData?(): Promise<void>
}

const getNativeModule = (): NativeLegacyMigrationModule | null =>
    requireOptionalNativeModule<NativeLegacyMigrationModule>('LegacyMigration')

const decodeBase64 = (value: unknown): Uint8Array | null => {
    if (value == null) return null
    if (typeof value !== 'string') return null
    return decodeFromBase64(value)
}

const errorMessage = (err: unknown): string =>
    err instanceof Error ? err.message : String(err)

const decodePerEntry = <Raw, Decoded>(
    entries: Raw[],
    decode: (entry: Raw) => Decoded,
    onError: (entry: Raw, err: unknown) => void,
): Decoded[] => {
    const decoded: Decoded[] = []
    for (const entry of entries) {
        try {
            decoded.push(decode(entry))
        } catch (err) {
            onError(entry, err)
        }
    }
    return decoded
}

const decodeAuthPin = (pin: Base64): Uint8Array | null => {
    try {
        return decodeBase64(pin)
    } catch (err) {
        warn('decodeBase64 failed for auth.pin; treating as no PIN', {
            error: errorMessage(err),
        })
        return null
    }
}

type Base64 = string | null
type LongString = string | null

interface RawLegacyMigrationData {
    schemaVersion: number
    sourcePlatform: LegacyMigrationSourcePlatform
    preferences: RawLegacyPreferences
    auth: { pin: Base64 }
    accounts: RawLegacyAccount[]
    hdWallets: RawLegacyHDWallet[]
    contacts: LegacyMigrationData['contacts']
    notificationFilters: string[]
    walletConnectV1: RawLegacyWalletConnectV1Session[]
    walletConnectV2: RawLegacyWalletConnectV2Session[]
    walletConnectHistoryBlob?: string | null
    passkeys: RawLegacyPasskey[]
    deviceIdentifiers: RawLegacyDeviceIdentifiers
    tooltipPreferences?: Partial<LegacyMigrationData['tooltipPreferences']>
    dismissedBanners?: LegacyMigrationData['dismissedBanners']
}

type RawLegacyPreferences = Omit<
    LegacyMigrationData['preferences'],
    | 'lockPenaltyRemainingMs'
    | 'appAtBackgroundMs'
    | 'notificationRefreshTimestampMs'
> & {
    lockPenaltyRemainingMs: LongString
    appAtBackgroundMs: LongString
    notificationRefreshTimestampMs: LongString
}

interface RawLegacyAccount extends Omit<
    LegacyAccount,
    'secretKey' | 'authAddress'
> {
    secretKey: Base64
    authAddress?: string | null
}

interface RawLegacyHDWallet extends Omit<LegacyHDWallet, 'entropy' | 'keys'> {
    entropy: Base64
    keys: RawLegacyHDKey[]
}

interface RawLegacyHDKey extends Omit<LegacyHDKey, 'privateKey'> {
    privateKey: Base64
}

interface RawLegacyWalletConnectV1Session extends Omit<
    LegacyWalletConnectV1Session,
    | 'dateTimestampMs'
    | 'clientId'
    | 'peerId'
    | 'handshakeId'
    | 'currentKey'
    | 'approvedAccounts'
    | 'chainId'
> {
    // iOS emits null when the legacy session has no stored date.
    dateTimestampMs: LongString | number | null
    clientId?: string | null
    peerId?: string | null
    handshakeId?: LongString | number | null
    currentKey?: string | null
    approvedAccounts?: string[] | null
    chainId?: number | null
}

interface RawLegacyWalletConnectV2Session extends Omit<
    LegacyWalletConnectV2Session,
    'dateTimestampMs'
> {
    dateTimestampMs: LongString | number
}

interface RawLegacyPasskey extends Omit<LegacyPasskey, 'lastUsedAtMs'> {
    lastUsedAtMs: LongString | number | null
}

interface RawLegacyDeviceIdentifiers extends Omit<
    LegacyMigrationData['deviceIdentifiers'],
    'lastSeenNotificationId'
> {
    lastSeenNotificationId: LongString
}

const decodeLegacyMigrationData = (
    raw: RawLegacyMigrationData,
): LegacyMigrationData => {
    if (raw.schemaVersion !== LEGACY_MIGRATION_SCHEMA_VERSION) {
        throw new Error(
            `Unsupported legacy migration schema version: ${raw.schemaVersion} (expected ${LEGACY_MIGRATION_SCHEMA_VERSION})`,
        )
    }
    const { accounts, undecodableAccounts } = decodeAccounts(raw.accounts)
    return {
        schemaVersion: raw.schemaVersion,
        sourcePlatform: raw.sourcePlatform,
        preferences: {
            ...raw.preferences,
            lockPenaltyRemainingMs: decodeLongString(
                raw.preferences.lockPenaltyRemainingMs,
                'lockPenaltyRemainingMs',
            ),
            appAtBackgroundMs: decodeLongString(
                raw.preferences.appAtBackgroundMs,
                'appAtBackgroundMs',
            ),
            notificationRefreshTimestampMs: decodeLongString(
                raw.preferences.notificationRefreshTimestampMs,
                'notificationRefreshTimestampMs',
            ),
        },
        auth: { pin: decodeAuthPin(raw.auth.pin) },
        accounts,
        undecodableAccounts,
        hdWallets: decodeHDWallets(raw.hdWallets),
        contacts: raw.contacts,
        notificationFilters: raw.notificationFilters,
        walletConnectV1: raw.walletConnectV1.map(decodeWalletConnectV1Session),
        walletConnectV2: raw.walletConnectV2.map(decodeWalletConnectV2Session),
        walletConnectHistoryBlob: raw.walletConnectHistoryBlob,
        passkeys: raw.passkeys.map(decodePasskey),
        deviceIdentifiers: {
            ...raw.deviceIdentifiers,
            lastSeenNotificationId: decodeLongString(
                raw.deviceIdentifiers.lastSeenNotificationId,
                'lastSeenNotificationId',
            ),
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
            ...raw.tooltipPreferences,
        },
        dismissedBanners: {
            bannerIds: raw.dismissedBanners?.bannerIds ?? [],
        },
    }
}

const decodeAccount = (raw: RawLegacyAccount): LegacyAccount => ({
    ...raw,
    secretKey: decodeBase64(raw.secretKey),
    authAddress: raw.authAddress ?? null,
})

const decodeAccounts = (
    raw: RawLegacyAccount[],
): {
    accounts: LegacyAccount[]
    undecodableAccounts: LegacyUndecodableAccount[]
} => {
    const undecodableAccounts: LegacyUndecodableAccount[] = []
    const accounts = decodePerEntry(raw, decodeAccount, (entry, err) => {
        const error = errorMessage(err)
        warn('decodeAccount failed; recording account as undecodable', {
            address: entry.address,
            error,
        })
        undecodableAccounts.push({
            address: entry.address,
            name: entry.name,
            error,
        })
    })
    return { accounts, undecodableAccounts }
}

const decodeHDWallet = (raw: RawLegacyHDWallet): LegacyHDWallet => ({
    ...raw,
    entropy: decodeBase64(raw.entropy),
    keys: raw.keys.map(decodeHDKey),
})

const decodeHDWallets = (raw: RawLegacyHDWallet[]): LegacyHDWallet[] =>
    decodePerEntry(raw, decodeHDWallet, (entry, err) => {
        warn(
            'decodeHDWallet failed; dropping wallet (its accounts will fail migration)',
            { walletId: entry.walletId, error: errorMessage(err) },
        )
    })

const decodeHDKey = (raw: RawLegacyHDKey): LegacyHDKey => ({
    ...raw,
    privateKey: decodeBase64(raw.privateKey),
})

const decodeWalletConnectV1Session = (
    raw: RawLegacyWalletConnectV1Session,
): LegacyWalletConnectV1Session => ({
    ...raw,
    dateTimestampMs:
        decodeLongString(raw.dateTimestampMs, 'dateTimestampMs') ?? 0,
    clientId: raw.clientId ?? null,
    peerId: raw.peerId ?? null,
    handshakeId: decodeLongString(raw.handshakeId, 'handshakeId'),
    currentKey: raw.currentKey ?? null,
    approvedAccounts: raw.approvedAccounts ?? null,
    chainId: raw.chainId ?? null,
})

const decodeWalletConnectV2Session = (
    raw: RawLegacyWalletConnectV2Session,
): LegacyWalletConnectV2Session => ({
    ...raw,
    dateTimestampMs:
        decodeLongString(raw.dateTimestampMs, 'dateTimestampMs') ?? 0,
})

const decodePasskey = (raw: RawLegacyPasskey): LegacyPasskey => ({
    ...raw,
    lastUsedAtMs: decodeLongString(raw.lastUsedAtMs, 'lastUsedAtMs'),
})

const emptyLegacyMigrationData = (): LegacyMigrationData => ({
    schemaVersion: LEGACY_MIGRATION_SCHEMA_VERSION,
    sourcePlatform: Platform.OS === 'ios' ? 'ios' : 'android',
    preferences: {
        theme: null,
        currency: null,
        termsAcceptedVersion: null,
        biometricEnabled: null,
        rekeySupport: null,
        privacyMode: null,
        arc59ExpressSendWarningEnabled: null,
        applicationOpenCount: null,
        lockAttemptCount: null,
        lockPenaltyRemainingMs: null,
        appAtBackgroundMs: null,
        notificationRefreshTimestampMs: null,
        copyAddressCount: null,
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
    dismissedBanners: { bannerIds: [] },
})
