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
import { renderHook, waitFor } from '@testing-library/react'

const { stores, withSecretMock, parsePinRecordMock, mkStore, seedStores } =
    vi.hoisted(() => {
        const make = (state: Record<string, unknown>) =>
            Object.assign(
                <T>(selector: (s: Record<string, unknown>) => T): T =>
                    selector(state),
                { getState: () => state },
            )
        const stores = {
            settings: {} as Record<string, unknown>,
            currencies: {} as Record<string, unknown>,
            assetPrefs: {} as Record<string, unknown>,
            collectiblePrefs: {} as Record<string, unknown>,
            accounts: {} as Record<string, unknown>,
            contacts: {} as Record<string, unknown>,
            notifications: {} as Record<string, unknown>,
            device: {} as Record<string, unknown>,
            swaps: {} as Record<string, unknown>,
        }
        const seedStores = () => {
            for (const key of Object.keys(stores) as Array<
                keyof typeof stores
            >) {
                for (const prop of Object.keys(stores[key]))
                    delete stores[key][prop]
            }
            Object.assign(stores.settings, {
                theme: 'light',
                privacyMode: false,
                preferences: {
                    'swap-introduction-seen': true,
                    'legacy.foo': 'bar',
                    'legacy.count': 7,
                    regular: 'ignored',
                },
            })
            Object.assign(stores.currencies, { preferredCurrency: 'USD' })
            Object.assign(stores.assetPrefs, {
                hideZeroBalance: true,
                displayNfts: false,
                displayOptedInNfts: true,
                assetSortMode: 'alphabeticalAsc',
            })
            Object.assign(stores.collectiblePrefs, {
                showOptedIn: false,
                showWatchAccounts: true,
                galleryLayout: 'grid',
                collectibleSortMode: 'titleAsc',
            })
            Object.assign(stores.accounts, {
                accounts: [
                    { address: 'ADDR_A', name: 'A' },
                    { address: 'ADDR_B', name: 'B' },
                ],
                sortMode: 'manual',
                manualAccountOrder: ['ADDR_A', 'ADDR_B'],
            })
            Object.assign(stores.contacts, {
                contacts: [
                    { id: '1', name: 'Alice', address: 'ADDR_C1' },
                    { id: '2', name: 'Bob', address: 'ADDR_C2' },
                ],
            })
            Object.assign(stores.notifications, {
                notificationDisabledAccounts: ['ADDR_MUTED'],
            })
            Object.assign(stores.device, {
                deviceIDs: new Map([
                    ['mainnet', 'm-id'],
                    ['testnet', 't-id'],
                ]),
                deviceIdOrigins: { mainnet: 'migrated' },
            })
            Object.assign(stores.swaps, { slippage: '0.5' })
        }
        seedStores()
        return {
            mkStore: make,
            stores,
            seedStores,
            withSecretMock: vi.fn(),
            parsePinRecordMock: vi.fn(),
        }
    })

vi.mock('@perawallet/wallet-core-settings', () => ({
    useSettingsStore: mkStore(stores.settings),
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrenciesStore: mkStore(stores.currencies),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetPreferencesStore: mkStore(stores.assetPrefs),
    useCollectiblePreferencesStore: mkStore(stores.collectiblePrefs),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: mkStore(stores.accounts),
}))

vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContactsStore: mkStore(stores.contacts),
}))

vi.mock('@perawallet/wallet-core-messages', () => ({
    useNotificationsStore: mkStore(stores.notifications),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceStore: mkStore(stores.device),
}))

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useSwapsStore: mkStore(stores.swaps),
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    Networks: { mainnet: 'mainnet', testnet: 'testnet' },
}))

vi.mock('@perawallet/wallet-core-security', () => ({
    PIN_RECORD_KEY_ID: 'PIN_KEY',
    BIOMETRIC_BLOB_KEY_ID: 'BIO_KEY',
    parsePinRecord: parsePinRecordMock,
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    withSecret: withSecretMock,
}))

import { useRNMigrationSnapshot } from '../useRNMigrationSnapshot'

beforeEach(() => {
    seedStores()
    withSecretMock.mockReset()
    withSecretMock.mockResolvedValue(null)
    parsePinRecordMock.mockReset()
})

describe('useRNMigrationSnapshot > preferences', () => {
    it('mirrors theme, currency, privacyMode, and asset filters from their stores', () => {
        const { result } = renderHook(() => useRNMigrationSnapshot())

        expect(result.current.preferences).toMatchObject({
            theme: 'light',
            currency: 'USD',
            privacyMode: false,
            assetFilterZeroBalance: true,
            assetFilterDisplayNFT: false,
            assetFilterDisplayOptedInNFT: true,
            accountSortPreference: 'manual',
            assetSortPreference: 'alphabeticalAsc',
            collectibleSortPreference: 'titleAsc',
            nftListingViewType: 'grid',
        })
    })

    it('inverts showOptedIn into collectibleFilterNotOwned', () => {
        const { result } = renderHook(() => useRNMigrationSnapshot())

        expect(result.current.preferences.collectibleFilterNotOwned).toBe(true)
    })

    it('passes nftFilterDisplayWatchAccountNFTs through from showWatchAccounts', () => {
        const { result } = renderHook(() => useRNMigrationSnapshot())

        expect(
            result.current.preferences.nftFilterDisplayWatchAccountNFTs,
        ).toBe(true)
    })

    it('parses a valid numeric slippage into swapSlippageTolerance', () => {
        const { result } = renderHook(() => useRNMigrationSnapshot())

        expect(result.current.preferences.swapSlippageTolerance).toBe(0.5)
    })

    it('returns null swapSlippageTolerance for empty slippage', () => {
        stores.swaps.slippage = ''

        const { result } = renderHook(() => useRNMigrationSnapshot())

        expect(result.current.preferences.swapSlippageTolerance).toBeNull()
    })

    it('returns null swapSlippageTolerance for non-numeric slippage', () => {
        stores.swaps.slippage = 'abc'

        const { result } = renderHook(() => useRNMigrationSnapshot())

        expect(result.current.preferences.swapSlippageTolerance).toBeNull()
    })

    it('derives swapTermsAccepted from the swap-introduction-seen preference', () => {
        const { result } = renderHook(() => useRNMigrationSnapshot())

        expect(result.current.preferences.swapTermsAccepted).toBe(true)
    })
})

describe('useRNMigrationSnapshot > derived maps', () => {
    it('builds accountsByAddress keyed by account.address', () => {
        const { result } = renderHook(() => useRNMigrationSnapshot())

        expect(result.current.accountsByAddress.get('ADDR_A')?.name).toBe('A')
        expect(result.current.accountsByAddress.get('ADDR_B')?.name).toBe('B')
    })

    it('builds contactsByAddress with lowercase address keys', () => {
        stores.contacts.contacts = [
            { id: '1', name: 'Alice', address: 'ADDR_MIXED' },
        ]

        const { result } = renderHook(() => useRNMigrationSnapshot())

        expect(result.current.contactsByAddress.get('addr_mixed')?.name).toBe(
            'Alice',
        )
    })

    it('converts notificationDisabledAccounts into a Set', () => {
        const { result } = renderHook(() => useRNMigrationSnapshot())

        expect(result.current.notificationDisabledAccounts).toBeInstanceOf(Set)
        expect(
            result.current.notificationDisabledAccounts.has('ADDR_MUTED'),
        ).toBe(true)
    })

    it('extracts deviceIDs from the device store by network', () => {
        const { result } = renderHook(() => useRNMigrationSnapshot())

        expect(result.current.deviceIDs).toEqual({
            mainnet: 'm-id',
            testnet: 't-id',
        })
    })

    it('falls back to null when a device id is missing from the store', () => {
        stores.device.deviceIDs = new Map([['mainnet', 'only-m']])

        const { result } = renderHook(() => useRNMigrationSnapshot())

        expect(result.current.deviceIDs).toEqual({
            mainnet: 'only-m',
            testnet: null,
        })
    })

    it('extracts deviceIdOrigins per network, null when untracked', () => {
        const { result } = renderHook(() => useRNMigrationSnapshot())

        expect(result.current.deviceIdOrigins).toEqual({
            mainnet: 'migrated',
            testnet: null,
        })
    })

    it('reflects a recreated device id origin', () => {
        stores.device.deviceIdOrigins = { mainnet: 'recreated' }

        const { result } = renderHook(() => useRNMigrationSnapshot())

        expect(result.current.deviceIdOrigins.mainnet).toBe('recreated')
    })

    it('collects legacy.* preferences into legacyStash and drops other keys', () => {
        const { result } = renderHook(() => useRNMigrationSnapshot())

        expect(result.current.legacyStash).toEqual({
            'legacy.foo': 'bar',
            'legacy.count': 7,
        })
    })
})

describe('useRNMigrationSnapshot > auth effect', () => {
    it('starts with auth defaulted to no-pin / no-biometric', () => {
        const { result } = renderHook(() => useRNMigrationSnapshot())

        expect(result.current.auth).toEqual({
            hasPin: false,
            pinRecordVersion: null,
            pinRecordBytes: null,
            hasBiometric: false,
            biometricBytes: null,
        })
    })

    it('populates auth from secure storage when both pin and biometric exist', async () => {
        withSecretMock.mockImplementation(
            async (key: string, handler: (bytes: Uint8Array) => unknown) => {
                if (key === 'PIN_KEY')
                    return handler(new Uint8Array(80).fill(2))
                if (key === 'BIO_KEY') return handler(new Uint8Array(4).fill(3))
                return null
            },
        )
        parsePinRecordMock.mockReturnValue({ version: 3 })

        const { result } = renderHook(() => useRNMigrationSnapshot())

        await waitFor(() => {
            expect(result.current.auth.hasPin).toBe(true)
        })
        expect(result.current.auth).toEqual({
            hasPin: true,
            pinRecordVersion: 3,
            pinRecordBytes: 80,
            hasBiometric: true,
            biometricBytes: 4,
        })
    })

    it('reports hasPin false and pinRecordVersion null when no pin is stored', async () => {
        withSecretMock.mockResolvedValue(null)

        const { result } = renderHook(() => useRNMigrationSnapshot())

        await waitFor(() => {
            expect(withSecretMock).toHaveBeenCalled()
        })
        expect(result.current.auth.hasPin).toBe(false)
        expect(result.current.auth.pinRecordVersion).toBeNull()
        expect(parsePinRecordMock).not.toHaveBeenCalled()
    })
})
