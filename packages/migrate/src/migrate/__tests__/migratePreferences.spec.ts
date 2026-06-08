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

import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
    settingsMock,
    currenciesMock,
    assetsMock,
    collectiblesMock,
    accountsMock,
} = vi.hoisted(() => ({
    settingsMock: {
        setTheme: vi.fn(),
        setPrivacyMode: vi.fn(),
        setPreference: vi.fn(),
    },
    currenciesMock: { setPreferredCurrency: vi.fn() },
    assetsMock: {
        setHideZeroBalance: vi.fn(),
        setDisplayNfts: vi.fn(),
        setDisplayOptedInNfts: vi.fn(),
        setAssetSortMode: vi.fn(),
    },
    collectiblesMock: {
        setShowOptedIn: vi.fn(),
        setShowWatchAccounts: vi.fn(),
        setGalleryLayout: vi.fn(),
        setCollectibleSortMode: vi.fn(),
    },
    accountsMock: { setSortMode: vi.fn() },
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    useSettingsStore: { getState: () => settingsMock },
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrenciesStore: { getState: () => currenciesMock },
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetPreferencesStore: { getState: () => assetsMock },
    useCollectiblePreferencesStore: { getState: () => collectiblesMock },
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: { getState: () => accountsMock },
}))

import type { LegacyPreferences } from '@perawallet/wallet-extension-platform'
import { migratePreferences } from '../migratePreferences'

const buildPreferences = (
    overrides: Partial<LegacyPreferences> = {},
): LegacyPreferences =>
    ({
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
        pinSetupPromptDismissed: null,
        rawFlags: {},
        ...overrides,
    }) as LegacyPreferences

beforeEach(() => {
    Object.values(settingsMock).forEach(fn => fn.mockReset())
    Object.values(currenciesMock).forEach(fn => fn.mockReset())
    Object.values(assetsMock).forEach(fn => fn.mockReset())
    Object.values(collectiblesMock).forEach(fn => fn.mockReset())
    Object.values(accountsMock).forEach(fn => fn.mockReset())
})

describe('migratePreferences > appearance', () => {
    it('writes theme when present', () => {
        migratePreferences(
            buildPreferences({ theme: 'dark' } as Partial<LegacyPreferences>),
        )
        expect(settingsMock.setTheme).toHaveBeenCalledWith('dark')
    })

    it('writes privacyMode when present (including false)', () => {
        migratePreferences(buildPreferences({ privacyMode: false }))
        expect(settingsMock.setPrivacyMode).toHaveBeenCalledWith(false)
    })

    it('skips appearance writes when both are null', () => {
        migratePreferences(buildPreferences())
        expect(settingsMock.setTheme).not.toHaveBeenCalled()
        expect(settingsMock.setPrivacyMode).not.toHaveBeenCalled()
    })
})

describe('migratePreferences > currency', () => {
    it('writes preferred currency when set', () => {
        migratePreferences(buildPreferences({ currency: 'EUR' }))
        expect(currenciesMock.setPreferredCurrency).toHaveBeenCalledWith('EUR')
    })

    it('skips when currency is null or empty', () => {
        migratePreferences(buildPreferences({ currency: '' }))
        migratePreferences(buildPreferences({ currency: null }))
        expect(currenciesMock.setPreferredCurrency).not.toHaveBeenCalled()
    })
})

describe('migratePreferences > asset filters', () => {
    it('writes every asset preference when all are set', () => {
        migratePreferences(
            buildPreferences({
                assetFilterZeroBalance: true,
                assetFilterDisplayNFT: false,
                assetFilterDisplayOptedInNFT: true,
                assetSortPreference: 'manual' as never,
            }),
        )

        expect(assetsMock.setHideZeroBalance).toHaveBeenCalledWith(true)
        expect(assetsMock.setDisplayNfts).toHaveBeenCalledWith(false)
        expect(assetsMock.setDisplayOptedInNfts).toHaveBeenCalledWith(true)
        expect(assetsMock.setAssetSortMode).toHaveBeenCalledWith('manual')
    })

    it('writes only the asset preferences that are non-null', () => {
        migratePreferences(buildPreferences({ assetFilterZeroBalance: false }))

        expect(assetsMock.setHideZeroBalance).toHaveBeenCalledWith(false)
        expect(assetsMock.setDisplayNfts).not.toHaveBeenCalled()
        expect(assetsMock.setDisplayOptedInNfts).not.toHaveBeenCalled()
        expect(assetsMock.setAssetSortMode).not.toHaveBeenCalled()
    })
})

describe('migratePreferences > collectible preferences', () => {
    it('inverts collectibleFilterNotOwned into setShowOptedIn', () => {
        migratePreferences(
            buildPreferences({ collectibleFilterNotOwned: false }),
        )
        expect(collectiblesMock.setShowOptedIn).toHaveBeenCalledWith(true)
    })

    it('passes through showWatchAccounts, layout, and sort mode', () => {
        migratePreferences(
            buildPreferences({
                nftFilterDisplayWatchAccountNFTs: true,
                nftListingViewType: 'grid' as never,
                collectibleSortPreference: 'name' as never,
            }),
        )

        expect(collectiblesMock.setShowWatchAccounts).toHaveBeenCalledWith(true)
        expect(collectiblesMock.setGalleryLayout).toHaveBeenCalledWith('grid')
        expect(collectiblesMock.setCollectibleSortMode).toHaveBeenCalledWith(
            'name',
        )
    })

    it('skips every collectible setter when all are null', () => {
        migratePreferences(buildPreferences())
        expect(collectiblesMock.setShowOptedIn).not.toHaveBeenCalled()
        expect(collectiblesMock.setShowWatchAccounts).not.toHaveBeenCalled()
        expect(collectiblesMock.setGalleryLayout).not.toHaveBeenCalled()
        expect(collectiblesMock.setCollectibleSortMode).not.toHaveBeenCalled()
    })
})

describe('migratePreferences > account sort', () => {
    it('writes account sort mode when set', () => {
        migratePreferences(
            buildPreferences({ accountSortPreference: 'manual' as never }),
        )
        expect(accountsMock.setSortMode).toHaveBeenCalledWith('manual')
    })

    it('skips when account sort is null', () => {
        migratePreferences(buildPreferences())
        expect(accountsMock.setSortMode).not.toHaveBeenCalled()
    })
})

describe('migratePreferences > pin setup prompt', () => {
    it('writes the dismissal preference only when explicitly true', () => {
        migratePreferences(buildPreferences({ pinSetupPromptDismissed: true }))
        expect(settingsMock.setPreference).toHaveBeenCalledWith(
            'security_pin_setup_prompt',
            true,
        )
    })

    it('skips the dismissal preference when false or null', () => {
        migratePreferences(buildPreferences({ pinSetupPromptDismissed: false }))
        migratePreferences(buildPreferences())
        expect(
            settingsMock.setPreference.mock.calls.find(
                c => c[0] === 'security_pin_setup_prompt',
            ),
        ).toBeUndefined()
    })
})

describe('migratePreferences > misc flags', () => {
    it('writes every misc flag namespaced under legacy.', () => {
        migratePreferences(
            buildPreferences({
                termsAcceptedVersion: 7,
                biometricEnabled: true,
                rekeySupport: false,
                arc59ExpressSendWarningEnabled: true,
                applicationOpenCount: 12,
                appAtBackgroundMs: 1700,
                notificationRefreshTimestampMs: 0,
                copyAddressCount: 4,
            }),
        )

        const calls = settingsMock.setPreference.mock.calls
        expect(calls).toContainEqual(['legacy.termsAcceptedVersion', 7])
        expect(calls).toContainEqual(['legacy.biometricEnabled', true])
        expect(calls).toContainEqual(['legacy.rekeySupport', false])
        expect(calls).toContainEqual([
            'legacy.arc59ExpressSendWarningEnabled',
            true,
        ])
        expect(calls).toContainEqual(['legacy.applicationOpenCount', 12])
        expect(calls).toContainEqual(['legacy.appAtBackgroundMs', 1700])
        expect(calls).toContainEqual([
            'legacy.notificationRefreshTimestampMs',
            0,
        ])
        expect(calls).toContainEqual(['legacy.copyAddressCount', 4])
    })

    it('skips null/undefined misc flags', () => {
        migratePreferences(buildPreferences())
        expect(
            settingsMock.setPreference.mock.calls.filter(c =>
                String(c[0]).startsWith('legacy.'),
            ),
        ).toEqual([])
    })

    it('persists primitive rawFlags but drops non-persistable types', () => {
        migratePreferences(
            buildPreferences({
                rawFlags: {
                    enabled: true,
                    count: 5,
                    label: 'hello',
                    dropMe: null,
                },
            }),
        )

        const rawCalls = settingsMock.setPreference.mock.calls.filter(c =>
            String(c[0]).startsWith('legacy.rawFlags.'),
        )
        expect(rawCalls).toContainEqual(['legacy.rawFlags.enabled', true])
        expect(rawCalls).toContainEqual(['legacy.rawFlags.count', 5])
        expect(rawCalls).toContainEqual(['legacy.rawFlags.label', 'hello'])
        expect(
            rawCalls.find(c => c[0] === 'legacy.rawFlags.dropMe'),
        ).toBeUndefined()
    })
})
