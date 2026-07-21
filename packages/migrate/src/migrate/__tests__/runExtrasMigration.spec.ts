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

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { loggerMock } = vi.hoisted(() => ({
    loggerMock: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: loggerMock,
}))

vi.mock('../migrateAuth', () => ({
    migrateAuth: vi.fn(async () => ({
        pinMigrated: true,
        biometricMigrated: true,
        lockoutMigrated: false,
    })),
}))

vi.mock('../migrateContacts', () => ({
    migrateContacts: vi.fn(() => ({ imported: 2, skipped: 1 })),
}))

vi.mock('../migrateDevice', () => ({
    migrateDeviceIdentifiers: vi.fn(),
}))

vi.mock('../migrateNotifications', () => ({
    migrateNotificationMutes: vi.fn(() => ({ muted: 3 })),
}))

vi.mock('../migratePreferences', () => ({
    migratePreferences: vi.fn(),
}))

vi.mock('../migratePasskeys', () => ({
    migratePasskeys: vi.fn(async () => ({ imported: 0, skipped: 0 })),
}))

vi.mock('../migrateStashed', () => ({
    migrateStashed: vi.fn(() => ({ walletConnectHistoryBlobStashed: true })),
}))

vi.mock('../migrateSwaps', () => ({
    migrateSwaps: vi.fn(),
}))

vi.mock('../migrateWalletConnect', () => ({
    migrateWalletConnect: vi.fn(() => ({ imported: 0, skipped: 0 })),
}))

import type { LegacyMigrationData } from '@perawallet/wallet-extension-platform'
import { runExtrasMigration } from '../runExtrasMigration'
import { migrateAuth } from '../migrateAuth'
import { migrateContacts } from '../migrateContacts'
import { migrateDeviceIdentifiers } from '../migrateDevice'
import { migrateNotificationMutes } from '../migrateNotifications'
import { migratePasskeys } from '../migratePasskeys'
import { migratePreferences } from '../migratePreferences'
import { migrateStashed } from '../migrateStashed'
import { migrateSwaps } from '../migrateSwaps'
import { migrateWalletConnect } from '../migrateWalletConnect'

const buildData = (
    overrides: Partial<LegacyMigrationData> = {},
): LegacyMigrationData =>
    ({
        schemaVersion: 1,
        sourcePlatform: 'ios' as never,
        preferences: { rawFlags: {} } as never,
        auth: { pin: null } as never,
        accounts: [],
        hdWallets: [],
        contacts: [],
        notificationFilters: ['MUTED_ADDR'],
        walletConnectV1: [],
        walletConnectV2: [],
        walletConnectHistoryBlob: 'blob',
        passkeys: [{ credentialId: 'p1' } as never],
        deviceIdentifiers: {} as never,
        tooltipPreferences: {} as never,
        dismissedBanners: { bannerIds: [] },
        ...overrides,
    }) as LegacyMigrationData

beforeEach(() => {
    vi.mocked(migrateAuth).mockClear()
    vi.mocked(migrateContacts).mockClear()
    vi.mocked(migrateDeviceIdentifiers).mockClear()
    vi.mocked(migrateNotificationMutes).mockClear()
    vi.mocked(migratePasskeys).mockClear()
    vi.mocked(migratePreferences).mockClear()
    vi.mocked(migrateStashed).mockClear()
    vi.mocked(migrateSwaps).mockClear()
    vi.mocked(migrateWalletConnect).mockClear()
    loggerMock.error.mockReset()

    vi.mocked(migrateAuth).mockResolvedValue({
        pinMigrated: true,
        biometricMigrated: true,
        lockoutMigrated: false,
    })
    vi.mocked(migrateContacts).mockReturnValue({ imported: 2, skipped: 1 })
    vi.mocked(migrateNotificationMutes).mockReturnValue({ muted: 3 })
    vi.mocked(migratePasskeys).mockResolvedValue({ imported: 0, skipped: 0 })
    vi.mocked(migrateStashed).mockReturnValue({
        walletConnectHistoryBlobStashed: true,
    })
    vi.mocked(migrateWalletConnect).mockReturnValue({ imported: 0, skipped: 0 })
})

describe('runExtrasMigration > happy path', () => {
    it('returns an aggregated all-success result when every step succeeds', async () => {
        const data = buildData()

        const result = await runExtrasMigration(data)

        expect(result).toEqual({
            preferences: true,
            swaps: true,
            deviceIdentifiers: true,
            contacts: { imported: 2, skipped: 1 },
            notifications: { muted: 3 },
            auth: {
                pinMigrated: true,
                biometricMigrated: true,
                lockoutMigrated: false,
            },
            walletConnect: { imported: 0, skipped: 0 },
            passkeys: { imported: 0, skipped: 0 },
            stashed: { walletConnectHistoryBlobStashed: true },
            failed: [],
        })
    })

    it('passes preferences into both migratePreferences and migrateSwaps', async () => {
        const preferences = { rawFlags: {}, marker: 'p' } as never
        await runExtrasMigration(buildData({ preferences }))

        expect(migratePreferences).toHaveBeenCalledWith(preferences)
        expect(migrateSwaps).toHaveBeenCalledWith(preferences)
    })

    it('passes the legacy payload arrays/objects to their step handlers', async () => {
        const data = buildData()
        await runExtrasMigration(data)

        expect(migrateDeviceIdentifiers).toHaveBeenCalledWith(
            data.deviceIdentifiers,
        )
        expect(migrateContacts).toHaveBeenCalledWith(data.contacts)
        expect(migrateNotificationMutes).toHaveBeenCalledWith(
            data.notificationFilters,
        )
        expect(migrateAuth).toHaveBeenCalledWith(data.auth, data.preferences)
        expect(migratePasskeys).toHaveBeenCalledWith(data.passkeys)
        expect(migrateStashed).toHaveBeenCalledWith({
            walletConnectHistoryBlob: data.walletConnectHistoryBlob,
        })
    })
})

describe('runExtrasMigration > step failures', () => {
    it('captures a sync step failure without stopping subsequent steps', async () => {
        vi.mocked(migratePreferences).mockImplementationOnce(() => {
            throw new Error('prefs broke')
        })

        const result = await runExtrasMigration(buildData())

        expect(result.preferences).toBe(false)
        expect(result.failed).toEqual([
            { step: 'preferences', reason: 'prefs broke' },
        ])
        expect(migrateSwaps).toHaveBeenCalled()
        expect(migrateAuth).toHaveBeenCalled()
        expect(migrateStashed).toHaveBeenCalled()
    })

    it('captures an async auth step failure', async () => {
        vi.mocked(migrateAuth).mockRejectedValueOnce(new Error('auth broke'))

        const result = await runExtrasMigration(buildData())

        expect(result.failed).toEqual([{ step: 'auth', reason: 'auth broke' }])
        expect(result.auth.pinMigrated).toBe(false)
        expect(migrateStashed).toHaveBeenCalled()
    })

    it('coerces non-Error throws via String()', async () => {
        vi.mocked(migrateSwaps).mockImplementationOnce(() => {
            throw 'string failure'
        })

        const result = await runExtrasMigration(buildData())

        expect(result.failed).toEqual([
            { step: 'swaps', reason: 'string failure' },
        ])
    })

    it('logs every failure via logger.error', async () => {
        vi.mocked(migrateContacts).mockImplementationOnce(() => {
            throw new Error('contacts broke')
        })

        await runExtrasMigration(buildData())

        expect(loggerMock.error).toHaveBeenCalledWith(
            'Legacy contacts migration failed',
            expect.objectContaining({ error: expect.any(Error) }),
        )
    })

    it('records multiple failures in order', async () => {
        vi.mocked(migratePreferences).mockImplementationOnce(() => {
            throw new Error('p')
        })
        vi.mocked(migrateContacts).mockImplementationOnce(() => {
            throw new Error('c')
        })

        const result = await runExtrasMigration(buildData())

        expect(result.failed.map(f => f.step)).toEqual([
            'preferences',
            'contacts',
        ])
    })
})

describe('runExtrasMigration > walletConnect step', () => {
    it('runs the walletConnect step and propagates counts', async () => {
        vi.mocked(migrateWalletConnect).mockReturnValue({
            imported: 2,
            skipped: 1,
        })

        const sessions: LegacyMigrationData['walletConnectV1'] = [
            {
                id: '42',
                peerMeta: {
                    name: 'Test dApp',
                    url: 'https://example.com',
                    icons: ['https://example.com/icon.png'],
                    description: 'A dApp',
                },
                isConnected: true,
                isSubscribed: true,
                dateTimestampMs: 1_700_000_000_000,
                fallbackBrowserGroupResponse: null,
                connectedAccounts: ['CONNECTED_ADDR'],
                sessionMetaJson: JSON.stringify({
                    bridge: 'https://bridge.walletconnect.org',
                    key: 'handshake-key',
                    topic: 'topic-1',
                    version: '1',
                }),
                clientId: 'client-1',
                peerId: 'peer-1',
                handshakeId: 1_690_000_000_000_001,
                currentKey: 'current-key',
                approvedAccounts: ['APPROVED_ADDR'],
                chainId: 416_002,
            },
        ]
        const data = buildData({ walletConnectV1: sessions })
        const result = await runExtrasMigration(data)

        expect(vi.mocked(migrateWalletConnect)).toHaveBeenCalledWith(sessions)
        expect(result.walletConnect).toEqual({ imported: 2, skipped: 1 })
        expect(result.failed).toEqual([])
    })

    it('records a walletConnect failure without breaking other steps', async () => {
        vi.mocked(migrateWalletConnect).mockImplementation(() => {
            throw new Error('boom')
        })

        const result = await runExtrasMigration(buildData())

        expect(result.walletConnect).toEqual({ imported: 0, skipped: 0 })
        expect(result.failed.map(f => f.step)).toContain('walletConnect')
        expect(vi.mocked(migrateStashed)).toHaveBeenCalled()
    })
})

describe('runExtrasMigration > passkeys step', () => {
    it('runs the passkeys step and propagates counts', async () => {
        vi.mocked(migratePasskeys).mockResolvedValue({
            imported: 3,
            skipped: 1,
        })

        const result = await runExtrasMigration(buildData())

        expect(result.passkeys).toEqual({ imported: 3, skipped: 1 })
        expect(result.failed).toEqual([])
    })

    it('records a passkeys failure without breaking later steps', async () => {
        vi.mocked(migratePasskeys).mockRejectedValueOnce(new Error('boom'))

        const result = await runExtrasMigration(buildData())

        expect(result.passkeys).toEqual({ imported: 0, skipped: 0 })
        expect(result.failed.map(f => f.step)).toContain('passkeys')
        expect(vi.mocked(migrateStashed)).toHaveBeenCalled()
    })
})

describe('runExtrasMigration > step filtering', () => {
    it('runs only the requested steps when a filter is provided', async () => {
        const data = buildData()
        const result = await runExtrasMigration(data, ['deviceIdentifiers'])

        expect(migrateDeviceIdentifiers).toHaveBeenCalledOnce()
        expect(migratePreferences).not.toHaveBeenCalled()
        expect(migrateContacts).not.toHaveBeenCalled()
        expect(result.deviceIdentifiers).toBe(true)
        expect(result.preferences).toBe(false)
    })

    it('runs every step when no filter is provided (back-compat)', async () => {
        const data = buildData()
        await runExtrasMigration(data)
        expect(migratePreferences).toHaveBeenCalledOnce()
        expect(migrateDeviceIdentifiers).toHaveBeenCalledOnce()
    })
})
