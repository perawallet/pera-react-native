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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
    LEGACY_MIGRATION_SCHEMA_VERSION,
    MIGRATION_SENTINEL_KEY,
    MIGRATION_STEPS_KEY,
    type KeyValueStorageService,
    type LegacyMigrationData,
    type MigrationSentinelValue,
} from '@perawallet/wallet-extension-platform'

const nativeModulesMock = vi.hoisted(() => ({
    LegacyMigration: undefined as unknown,
}))

const platformMock = vi.hoisted(() => ({ OS: 'ios' as 'ios' | 'android' }))

const loggerMock = vi.hoisted(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
}))

vi.mock('expo', () => ({
    requireOptionalNativeModule: (name: string) =>
        name === 'LegacyMigration' ? nativeModulesMock.LegacyMigration : null,
}))

vi.mock('react-native', () => ({
    Platform: platformMock,
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared')
    >('@perawallet/wallet-core-shared')
    return {
        ...actual,
        logger: loggerMock,
    }
})

import { RNMigrationService } from '../services/migration'

type NativeModule = {
    hasLegacyData: ReturnType<typeof vi.fn>
    getLegacyData: ReturnType<typeof vi.fn>
    getMigrationPlans?: ReturnType<typeof vi.fn>
    simulateLegacyDatabase?: ReturnType<typeof vi.fn>
    simulatePreSixxAccounts?: ReturnType<typeof vi.fn>
    resetLegacyData?: ReturnType<typeof vi.fn>
}

const createNativeModule = (
    overrides: Partial<NativeModule> = {},
): NativeModule => ({
    hasLegacyData: vi.fn().mockResolvedValue(false),
    getLegacyData: vi.fn(),
    getMigrationPlans: vi.fn().mockResolvedValue([]),
    simulateLegacyDatabase: vi.fn().mockResolvedValue(undefined),
    simulatePreSixxAccounts: vi.fn().mockResolvedValue(undefined),
    resetLegacyData: vi.fn().mockResolvedValue(undefined),
    ...overrides,
})

const createKeyValueStorage = (): KeyValueStorageService => {
    const storage = new Map<string, string>()
    return {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
            storage.set(key, value)
        },
        removeItem: (key: string) => {
            storage.delete(key)
        },
        setJSON: <T>(key: string, value: T) =>
            storage.set(key, JSON.stringify(value)),
        getJSON: <T>(key: string): T | null => {
            const raw = storage.get(key)
            return raw ? (JSON.parse(raw) as T) : null
        },
        getAllKeys: () => Array.from(storage.keys()),
    }
}

const buildRawPayload = (overrides: Record<string, unknown> = {}) => ({
    schemaVersion: LEGACY_MIGRATION_SCHEMA_VERSION,
    sourcePlatform: 'ios' as const,
    preferences: {
        theme: 'dark',
        currency: 'USD',
        termsAcceptedVersion: 1,
        biometricEnabled: true,
        rekeySupport: true,
        privacyMode: false,
        arc59ExpressSendWarningEnabled: true,
        applicationOpenCount: 10,
        lockAttemptCount: 0,
        lockPenaltyRemainingMs: '0',
        appAtBackgroundMs: '1700000000000',
        notificationRefreshTimestampMs: null,
        copyAddressCount: 3,
        assetFilterZeroBalance: false,
        assetFilterDisplayNFT: true,
        assetFilterDisplayOptedInNFT: true,
        collectibleFilterNotOwned: false,
        nftFilterDisplayWatchAccountNFTs: false,
        nftListingViewType: 'grid',
        accountSortPreference: 'manual',
        assetSortPreference: 'alphabeticalAsc',
        collectibleSortPreference: 'titleAsc',
        swapLastUsedAddress: null,
        swapUseLocalCurrency: false,
        swapSlippageTolerance: 50,
        swapTermsAccepted: true,
        rawFlags: {},
    },
    auth: { pin: null },
    accounts: [],
    hdWallets: [],
    contacts: [],
    notificationFilters: [],
    walletConnectV1: [],
    walletConnectV2: [],
    walletConnectHistoryBlob: null,
    passkeys: [],
    deviceIdentifiers: {
        notificationUserId: null,
        mainnetDeviceId: null,
        testnetDeviceId: null,
        lastSeenNotificationId: null,
    },
    ...overrides,
})

describe('RNMigrationService', () => {
    let storage: KeyValueStorageService
    let service: RNMigrationService

    beforeEach(() => {
        vi.clearAllMocks()
        nativeModulesMock.LegacyMigration = undefined
        platformMock.OS = 'ios'
        storage = createKeyValueStorage()
        service = new RNMigrationService(storage)
    })

    describe('hasLegacyData', () => {
        test('returns false when the sentinel is already set', async () => {
            storage.setItem(
                MIGRATION_SENTINEL_KEY,
                JSON.stringify({
                    completedAt: Date.now(),
                    sourcePlatform: 'ios',
                }),
            )

            expect(await service.hasLegacyData()).toBe(false)
        })

        test('returns false when the native module is not registered', async () => {
            expect(await service.hasLegacyData()).toBe(false)
            expect(loggerMock.warn).toHaveBeenCalledWith(
                expect.stringContaining('not registered'),
                undefined,
            )
        })

        test('returns the native result when the module reports data', async () => {
            const module = createNativeModule({
                hasLegacyData: vi.fn().mockResolvedValue(true),
            })
            nativeModulesMock.LegacyMigration = module

            expect(await service.hasLegacyData()).toBe(true)
            expect(module.hasLegacyData).toHaveBeenCalledOnce()
        })

        test('rethrows when the native call throws', async () => {
            const err = new Error('boom')
            nativeModulesMock.LegacyMigration = createNativeModule({
                hasLegacyData: vi.fn().mockRejectedValue(err),
            })

            await expect(service.hasLegacyData()).rejects.toThrow('boom')
            expect(loggerMock.error).toHaveBeenCalled()
        })
    })

    describe('getLegacyData', () => {
        test('returns an empty payload when the native module is missing', async () => {
            const data = await service.getLegacyData()

            expect(data.schemaVersion).toBe(LEGACY_MIGRATION_SCHEMA_VERSION)
            expect(data.sourcePlatform).toBe('ios')
            expect(data.accounts).toEqual([])
            expect(data.hdWallets).toEqual([])
            expect(data.preferences.theme).toBeNull()
            expect(data.auth.pin).toBeNull()
            expect(data.dismissedBanners.bannerIds).toEqual([])
        })

        test('falls back to android sourcePlatform on android', async () => {
            platformMock.OS = 'android'

            const data = await service.getLegacyData()

            expect(data.sourcePlatform).toBe('android')
        })

        test('rethrows when the native call throws', async () => {
            nativeModulesMock.LegacyMigration = createNativeModule({
                getLegacyData: vi.fn().mockRejectedValue(new Error('native')),
            })

            await expect(service.getLegacyData()).rejects.toThrow('native')
            expect(loggerMock.error).toHaveBeenCalled()
        })

        test('throws when the schema version does not match', async () => {
            nativeModulesMock.LegacyMigration = createNativeModule({
                getLegacyData: vi
                    .fn()
                    .mockResolvedValue(buildRawPayload({ schemaVersion: 99 })),
            })

            await expect(service.getLegacyData()).rejects.toThrow(
                /Unsupported legacy migration schema version: 99/,
            )
        })

        test('decodes a complete payload through every decoder', async () => {
            // base64 'AQID' === bytes [1,2,3]
            const raw = buildRawPayload({
                sourcePlatform: 'android',
                auth: { pin: 'AQID' },
                accounts: [
                    {
                        address: 'A1',
                        name: 'Acc',
                        type: 'standard',
                        preferredOrder: 0,
                        isBackedUp: true,
                        secretKey: 'AQID',
                        hdWalletId: null,
                        ledger: null,
                        joint: null,
                    },
                ],
                hdWallets: [
                    {
                        walletId: 'W1',
                        name: 'Wallet',
                        entropy: 'AQID',
                        keys: [
                            {
                                address: 'K1',
                                account: 0,
                                change: 0,
                                keyIndex: 0,
                                derivationType: 1,
                                privateKey: 'AQID',
                            },
                        ],
                    },
                ],
                contacts: [{ name: 'C', address: 'X', avatar: null }],
                notificationFilters: ['ASSET_ID_123'],
                walletConnectV1: [
                    {
                        id: 'wc1',
                        peerMeta: {
                            name: 'dApp',
                            url: 'https://example.com',
                            icons: [],
                            description: '',
                        },
                        isConnected: true,
                        isSubscribed: true,
                        // numeric form
                        dateTimestampMs: 1700000000000,
                        fallbackBrowserGroupResponse: null,
                        connectedAccounts: [],
                        sessionMetaJson: '{}',
                        clientId: 'client-1',
                        peerId: 'peer-1',
                        // LongString form
                        handshakeId: '1690000000000001',
                        currentKey: 'ffff0000',
                        approvedAccounts: ['ADDR1'],
                        chainId: 416001,
                    },
                ],
                walletConnectV2: [
                    {
                        topic: 't',
                        // string form
                        dateTimestampMs: '1700000000001',
                        isSubscribed: false,
                        fallbackBrowserGroupResponse: null,
                    },
                ],
                walletConnectHistoryBlob: 'history',
                passkeys: [
                    {
                        credentialId: 'cred',
                        address: 'A1',
                        siteUrl: 'https://site',
                        siteName: null,
                        userName: null,
                        userDisplayName: null,
                        lastUsedAtMs: null,
                    },
                ],
                deviceIdentifiers: {
                    notificationUserId: 'nuid',
                    mainnetDeviceId: 'm',
                    testnetDeviceId: 't',
                    lastSeenNotificationId: '42',
                },
                tooltipPreferences: { qrTooltipSeen: true },
                dismissedBanners: { bannerIds: ['b1', 'b2'] },
            })
            nativeModulesMock.LegacyMigration = createNativeModule({
                getLegacyData: vi.fn().mockResolvedValue(raw),
            })

            const data: LegacyMigrationData = await service.getLegacyData()

            expect(data.sourcePlatform).toBe('android')
            expect(data.auth.pin).toEqual(new Uint8Array([1, 2, 3]))
            expect(data.accounts[0].secretKey).toEqual(
                new Uint8Array([1, 2, 3]),
            )
            expect(data.hdWallets[0].entropy).toEqual(new Uint8Array([1, 2, 3]))
            expect(data.hdWallets[0].keys[0].privateKey).toEqual(
                new Uint8Array([1, 2, 3]),
            )
            expect(data.walletConnectV1[0].dateTimestampMs).toBe(1700000000000)
            expect(data.walletConnectV1[0].clientId).toBe('client-1')
            expect(data.walletConnectV1[0].peerId).toBe('peer-1')
            expect(data.walletConnectV1[0].handshakeId).toBe(1690000000000001)
            expect(data.walletConnectV1[0].currentKey).toBe('ffff0000')
            expect(data.walletConnectV1[0].approvedAccounts).toEqual(['ADDR1'])
            expect(data.walletConnectV1[0].chainId).toBe(416001)
            expect(data.walletConnectV2[0].dateTimestampMs).toBe(1700000000001)
            expect(data.passkeys[0].lastUsedAtMs).toBeNull()
            expect(data.deviceIdentifiers.lastSeenNotificationId).toBe(42)
            expect(data.preferences.appAtBackgroundMs).toBe(1700000000000)
            // Filled defaults from tooltip + raw override
            expect(data.tooltipPreferences.qrTooltipSeen).toBe(true)
            expect(data.tooltipPreferences.copyAddressTooltipSeen).toBeNull()
            expect(data.dismissedBanners.bannerIds).toEqual(['b1', 'b2'])
            expect(data.contacts).toHaveLength(1)
        })

        test('decodeBase64 returns null for non-string and empty Uint8Array for empty string', async () => {
            const raw = buildRawPayload({
                auth: { pin: '' },
                accounts: [
                    {
                        address: 'A',
                        name: '',
                        type: 'standard',
                        preferredOrder: 0,
                        isBackedUp: false,
                        // non-string → null
                        secretKey: 42,
                        hdWalletId: null,
                        ledger: null,
                        joint: null,
                    },
                ],
            })
            nativeModulesMock.LegacyMigration = createNativeModule({
                getLegacyData: vi.fn().mockResolvedValue(raw),
            })

            const data = await service.getLegacyData()

            expect(data.auth.pin).toEqual(new Uint8Array(0))
            expect(data.accounts[0].secretKey).toBeNull()
        })

        test('decodeLongString still parses values exceeding MAX_SAFE_INTEGER (with precision loss)', async () => {
            const raw = buildRawPayload({
                deviceIdentifiers: {
                    notificationUserId: null,
                    mainnetDeviceId: null,
                    testnetDeviceId: null,
                    // beyond Number.MAX_SAFE_INTEGER (2^53 - 1 = 9007199254740991)
                    lastSeenNotificationId: '9999999999999999',
                },
            })
            nativeModulesMock.LegacyMigration = createNativeModule({
                getLegacyData: vi.fn().mockResolvedValue(raw),
            })

            const data = await service.getLegacyData()

            expect(data.deviceIdentifiers.lastSeenNotificationId).toBe(
                Number('9999999999999999'),
            )
        })

        test('decodeLongString returns null for non-numeric and empty strings', async () => {
            const raw = buildRawPayload({
                preferences: {
                    ...buildRawPayload().preferences,
                    lockPenaltyRemainingMs: 'not-a-number',
                    appAtBackgroundMs: '',
                    notificationRefreshTimestampMs: Number.NaN,
                },
            })
            nativeModulesMock.LegacyMigration = createNativeModule({
                getLegacyData: vi.fn().mockResolvedValue(raw),
            })

            const data = await service.getLegacyData()

            expect(data.preferences.lockPenaltyRemainingMs).toBeNull()
            expect(data.preferences.appAtBackgroundMs).toBeNull()
            expect(data.preferences.notificationRefreshTimestampMs).toBeNull()
        })

        test('walletConnect dateTimestampMs falls back to 0 and v1 enrichment fields default to null when absent', async () => {
            const raw = buildRawPayload({
                walletConnectV1: [
                    {
                        id: 'x',
                        peerMeta: {
                            name: '',
                            url: '',
                            icons: [],
                            description: '',
                        },
                        isConnected: false,
                        isSubscribed: false,
                        dateTimestampMs: 'oops',
                        fallbackBrowserGroupResponse: null,
                        connectedAccounts: [],
                        sessionMetaJson: '',
                    },
                ],
                walletConnectV2: [
                    {
                        topic: 't',
                        dateTimestampMs: null,
                        isSubscribed: false,
                        fallbackBrowserGroupResponse: null,
                    },
                ],
            })
            nativeModulesMock.LegacyMigration = createNativeModule({
                getLegacyData: vi.fn().mockResolvedValue(raw),
            })

            const data = await service.getLegacyData()

            expect(data.walletConnectV1[0].dateTimestampMs).toBe(0)
            expect(data.walletConnectV1[0].clientId).toBeNull()
            expect(data.walletConnectV1[0].peerId).toBeNull()
            expect(data.walletConnectV1[0].handshakeId).toBeNull()
            expect(data.walletConnectV1[0].currentKey).toBeNull()
            expect(data.walletConnectV1[0].approvedAccounts).toBeNull()
            expect(data.walletConnectV1[0].chainId).toBeNull()
            expect(data.walletConnectV2[0].dateTimestampMs).toBe(0)
        })

        test('summary log includes counts for each account variant', async () => {
            const raw = buildRawPayload({
                accounts: [
                    {
                        address: 'A1',
                        name: '',
                        type: 'standard',
                        preferredOrder: 0,
                        isBackedUp: true,
                        secretKey: 'AQID',
                        hdWalletId: 'w1',
                        ledger: null,
                        joint: null,
                    },
                    {
                        address: 'A2',
                        name: '',
                        type: 'ledger',
                        preferredOrder: 1,
                        isBackedUp: false,
                        secretKey: null,
                        hdWalletId: null,
                        ledger: {
                            bluetoothAddress: 'bt',
                            bluetoothName: null,
                            positionInLedger: 0,
                        },
                        joint: null,
                    },
                    {
                        address: 'A3',
                        name: '',
                        type: 'joint',
                        preferredOrder: 2,
                        isBackedUp: false,
                        secretKey: null,
                        hdWalletId: null,
                        ledger: null,
                        joint: {
                            threshold: 2,
                            version: 1,
                            participants: ['P1', 'P2'],
                        },
                    },
                ],
            })
            nativeModulesMock.LegacyMigration = createNativeModule({
                getLegacyData: vi.fn().mockResolvedValue(raw),
            })

            await service.getLegacyData()

            const summaryCall = loggerMock.info.mock.calls.find(call =>
                String(call[0]).includes('decoded'),
            )
            expect(summaryCall).toBeDefined()
            const summary = summaryCall![1] as Record<string, unknown>
            expect(summary.accounts).toBe(3)
            expect(summary.accountsWithSecretKey).toBe(1)
            expect(summary.accountsWithHDWallet).toBe(1)
            expect(summary.accountsWithLedger).toBe(1)
            expect(summary.accountsWithJoint).toBe(1)
        })

        describe('corrupt-blob resilience', () => {
            const CORRUPT_BASE64 = 'AQI'

            test('records an account whose secretKey blob is corrupt as undecodable and still decodes the rest', async () => {
                const raw = buildRawPayload({
                    accounts: [
                        {
                            address: 'BAD',
                            name: 'Corrupt',
                            type: 'standard',
                            preferredOrder: 0,
                            isBackedUp: true,
                            secretKey: CORRUPT_BASE64,
                            hdWalletId: null,
                            ledger: null,
                            joint: null,
                        },
                        {
                            address: 'GOOD',
                            name: 'Valid',
                            type: 'standard',
                            preferredOrder: 1,
                            isBackedUp: true,
                            secretKey: 'AQID',
                            hdWalletId: null,
                            ledger: null,
                            joint: null,
                        },
                    ],
                })
                nativeModulesMock.LegacyMigration = createNativeModule({
                    getLegacyData: vi.fn().mockResolvedValue(raw),
                })

                const data = await service.getLegacyData()

                expect(data.accounts).toHaveLength(1)
                expect(data.accounts[0].address).toBe('GOOD')
                expect(data.accounts[0].secretKey).toEqual(
                    new Uint8Array([1, 2, 3]),
                )
                expect(data.undecodableAccounts).toHaveLength(1)
                expect(data.undecodableAccounts[0].address).toBe('BAD')
                expect(data.undecodableAccounts[0].name).toBe('Corrupt')
                expect(data.undecodableAccounts[0].error).toBeTruthy()
                expect(loggerMock.warn).toHaveBeenCalled()
            })

            test('drops an HD wallet whose blob is corrupt instead of throwing', async () => {
                const raw = buildRawPayload({
                    hdWallets: [
                        {
                            walletId: 'W_BAD',
                            name: 'Corrupt',
                            entropy: CORRUPT_BASE64,
                            keys: [],
                        },
                        {
                            walletId: 'W_GOOD',
                            name: 'Valid',
                            entropy: 'AQID',
                            keys: [],
                        },
                    ],
                })
                nativeModulesMock.LegacyMigration = createNativeModule({
                    getLegacyData: vi.fn().mockResolvedValue(raw),
                })

                const data = await service.getLegacyData()

                expect(data.hdWallets).toHaveLength(1)
                expect(data.hdWallets[0].walletId).toBe('W_GOOD')
                expect(loggerMock.warn).toHaveBeenCalled()
            })

            test('nulls a corrupt auth.pin blob instead of throwing', async () => {
                const raw = buildRawPayload({
                    auth: { pin: CORRUPT_BASE64 },
                })
                nativeModulesMock.LegacyMigration = createNativeModule({
                    getLegacyData: vi.fn().mockResolvedValue(raw),
                })

                const data = await service.getLegacyData()

                expect(data.auth.pin).toBeNull()
                expect(loggerMock.warn).toHaveBeenCalled()
            })
        })
    })

    describe('isMigrationComplete', () => {
        test('returns true when a valid sentinel is present', async () => {
            const value: MigrationSentinelValue = {
                completedAt: 1_700_000_000_000,
                sourcePlatform: 'android',
            }
            storage.setItem(MIGRATION_SENTINEL_KEY, JSON.stringify(value))

            expect(await service.isMigrationComplete()).toBe(true)
        })

        test('returns false when no sentinel is set', async () => {
            expect(await service.isMigrationComplete()).toBe(false)
        })

        test('returns false (and warns) for non-JSON sentinel', async () => {
            storage.setItem(MIGRATION_SENTINEL_KEY, 'not-json')

            expect(await service.isMigrationComplete()).toBe(false)
            expect(loggerMock.warn).toHaveBeenCalledWith(
                expect.stringContaining('non-JSON sentinel'),
                expect.objectContaining({ raw: 'not-json' }),
            )
        })

        test('returns false (and warns) for sentinel with unknown sourcePlatform', async () => {
            storage.setItem(
                MIGRATION_SENTINEL_KEY,
                JSON.stringify({ completedAt: 0, sourcePlatform: 'web' }),
            )

            expect(await service.isMigrationComplete()).toBe(false)
            expect(loggerMock.warn).toHaveBeenCalledWith(
                expect.stringContaining('malformed sentinel value'),
                expect.objectContaining({
                    raw: expect.stringContaining('web'),
                }),
            )
        })
    })

    describe('markMigrationComplete', () => {
        test('writes a sentinel for ios', async () => {
            await service.markMigrationComplete('ios')

            const raw = storage.getItem(MIGRATION_SENTINEL_KEY)
            expect(raw).not.toBeNull()
            const parsed = JSON.parse(raw!) as MigrationSentinelValue
            expect(parsed.sourcePlatform).toBe('ios')
            expect(typeof parsed.completedAt).toBe('number')
        })

        test('writes a sentinel for android', async () => {
            await service.markMigrationComplete('android')

            const parsed = JSON.parse(
                storage.getItem(MIGRATION_SENTINEL_KEY)!,
            ) as MigrationSentinelValue
            expect(parsed.sourcePlatform).toBe('android')
        })
    })

    describe('clearMigrationComplete', () => {
        test('removes the sentinel', async () => {
            storage.setItem(MIGRATION_SENTINEL_KEY, 'x')
            await service.clearMigrationComplete()
            expect(storage.getItem(MIGRATION_SENTINEL_KEY)).toBeNull()
        })
    })

    describe('getMigrationPlans', () => {
        test('returns [] when the native module is missing', async () => {
            expect(await service.getMigrationPlans()).toEqual([])
        })

        test('returns [] when the module does not implement getMigrationPlans', async () => {
            nativeModulesMock.LegacyMigration = createNativeModule({
                getMigrationPlans: undefined,
            })
            expect(await service.getMigrationPlans()).toEqual([])
        })

        test('returns the native plans payload', async () => {
            const plans = [
                {
                    dbName: 'pera.db',
                    targetVersion: 3,
                    oldestSupported: 1,
                    readerImpact: 'low',
                    migrations: [],
                },
            ]
            nativeModulesMock.LegacyMigration = createNativeModule({
                getMigrationPlans: vi.fn().mockResolvedValue(plans),
            })

            expect(await service.getMigrationPlans()).toEqual(plans)
        })
    })

    describe('simulateLegacyDatabase', () => {
        const args = { dbName: 'pera.db', version: 3 }

        test('is a no-op when the native module is missing', async () => {
            await expect(
                service.simulateLegacyDatabase(args),
            ).resolves.toBeUndefined()
        })

        test('is a no-op when the method is unimplemented', async () => {
            nativeModulesMock.LegacyMigration = createNativeModule({
                simulateLegacyDatabase: undefined,
            })
            await expect(
                service.simulateLegacyDatabase(args),
            ).resolves.toBeUndefined()
        })

        test('forwards args and clears the sentinel', async () => {
            storage.setItem(MIGRATION_SENTINEL_KEY, 'x')
            const module = createNativeModule()
            nativeModulesMock.LegacyMigration = module

            await service.simulateLegacyDatabase(args)

            expect(module.simulateLegacyDatabase).toHaveBeenCalledWith(args)
            expect(storage.getItem(MIGRATION_SENTINEL_KEY)).toBeNull()
        })
    })

    describe('simulatePreSixxAccounts', () => {
        test('is a no-op when the native module is missing', async () => {
            await expect(
                service.simulatePreSixxAccounts(),
            ).resolves.toBeUndefined()
        })

        test('is a no-op when the method is unimplemented', async () => {
            nativeModulesMock.LegacyMigration = createNativeModule({
                simulatePreSixxAccounts: undefined,
            })
            await expect(
                service.simulatePreSixxAccounts(),
            ).resolves.toBeUndefined()
        })

        test('calls the native method and clears the sentinel', async () => {
            storage.setItem(MIGRATION_SENTINEL_KEY, 'x')
            const module = createNativeModule()
            nativeModulesMock.LegacyMigration = module

            await service.simulatePreSixxAccounts()

            expect(module.simulatePreSixxAccounts).toHaveBeenCalledOnce()
            expect(storage.getItem(MIGRATION_SENTINEL_KEY)).toBeNull()
        })
    })

    describe('resetLegacyData', () => {
        test('is a no-op when the native module is missing', async () => {
            await expect(service.resetLegacyData()).resolves.toBeUndefined()
        })

        test('is a no-op when the method is unimplemented', async () => {
            nativeModulesMock.LegacyMigration = createNativeModule({
                resetLegacyData: undefined,
            })
            await expect(service.resetLegacyData()).resolves.toBeUndefined()
        })

        test('calls the native method and clears the sentinel', async () => {
            storage.setItem(MIGRATION_SENTINEL_KEY, 'x')
            const module = createNativeModule()
            nativeModulesMock.LegacyMigration = module

            await service.resetLegacyData()

            expect(module.resetLegacyData).toHaveBeenCalledOnce()
            expect(storage.getItem(MIGRATION_SENTINEL_KEY)).toBeNull()
        })

        test('keeps the sentinel when the native reset throws (DB drop must succeed first)', async () => {
            storage.setItem(MIGRATION_SENTINEL_KEY, 'x')
            nativeModulesMock.LegacyMigration = createNativeModule({
                resetLegacyData: vi.fn().mockRejectedValue(new Error('boom')),
            })

            await expect(service.resetLegacyData()).rejects.toThrow('boom')
            expect(storage.getItem(MIGRATION_SENTINEL_KEY)).toBe('x')
        })
    })

    describe('step versions', () => {
        test('returns null when no step record exists', async () => {
            await expect(service.getCompletedStepVersions()).resolves.toBeNull()
        })

        test('round-trips a step-version record through key-value storage', async () => {
            await service.setCompletedStepVersions({
                accounts: 1,
                passkeys: 2,
            })
            await expect(service.getCompletedStepVersions()).resolves.toEqual({
                accounts: 1,
                passkeys: 2,
            })
        })

        test('ignores a malformed step record instead of throwing', async () => {
            storage.setItem(MIGRATION_STEPS_KEY, 'not-json{')
            await expect(service.getCompletedStepVersions()).resolves.toBeNull()
        })
    })
})
