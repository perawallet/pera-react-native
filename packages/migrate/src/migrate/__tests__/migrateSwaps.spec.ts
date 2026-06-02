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

const { settingsMock, swapsMock } = vi.hoisted(() => ({
    settingsMock: { setPreference: vi.fn() },
    swapsMock: { setSlippage: vi.fn() },
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    useSettingsStore: { getState: () => settingsMock },
}))

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useSwapsStore: { getState: () => swapsMock },
}))

import type { LegacyPreferences } from '@perawallet/wallet-extension-platform'
import { migrateSwaps } from '../migrateSwaps'

const buildPreferences = (
    overrides: Partial<LegacyPreferences> = {},
): LegacyPreferences =>
    ({
        swapSlippageTolerance: null,
        swapTermsAccepted: null,
        swapLastUsedAddress: null,
        swapUseLocalCurrency: null,
        rawFlags: {},
        ...overrides,
    }) as LegacyPreferences

beforeEach(() => {
    settingsMock.setPreference.mockReset()
    swapsMock.setSlippage.mockReset()
})

describe('migrateSwaps', () => {
    it('does nothing when every swap field is null', () => {
        migrateSwaps(buildPreferences())

        expect(swapsMock.setSlippage).not.toHaveBeenCalled()
        expect(settingsMock.setPreference).not.toHaveBeenCalled()
    })

    it('writes slippage as a string when present (including zero)', () => {
        migrateSwaps(buildPreferences({ swapSlippageTolerance: 0 }))
        expect(swapsMock.setSlippage).toHaveBeenCalledWith('0')

        swapsMock.setSlippage.mockReset()
        migrateSwaps(buildPreferences({ swapSlippageTolerance: 0.5 }))
        expect(swapsMock.setSlippage).toHaveBeenCalledWith('0.5')
    })

    it('marks the swap intro as seen only when termsAccepted is exactly true', () => {
        migrateSwaps(buildPreferences({ swapTermsAccepted: true }))
        expect(settingsMock.setPreference).toHaveBeenCalledWith(
            'swap-introduction-seen',
            true,
        )

        settingsMock.setPreference.mockReset()
        migrateSwaps(buildPreferences({ swapTermsAccepted: false }))
        expect(
            settingsMock.setPreference.mock.calls.find(
                c => c[0] === 'swap-introduction-seen',
            ),
        ).toBeUndefined()
    })

    it('writes the legacy last-used swap address when present', () => {
        migrateSwaps(buildPreferences({ swapLastUsedAddress: 'ADDR_X' }))

        expect(settingsMock.setPreference).toHaveBeenCalledWith(
            'legacy.swap.lastUsedAddress',
            'ADDR_X',
        )
    })

    it('writes legacy.swap.useLocalCurrency including when false', () => {
        migrateSwaps(buildPreferences({ swapUseLocalCurrency: false }))

        expect(settingsMock.setPreference).toHaveBeenCalledWith(
            'legacy.swap.useLocalCurrency',
            false,
        )
    })

    it('writes every swap field when all are present', () => {
        migrateSwaps(
            buildPreferences({
                swapSlippageTolerance: 1.25,
                swapTermsAccepted: true,
                swapLastUsedAddress: 'ADDR_Y',
                swapUseLocalCurrency: true,
            }),
        )

        expect(swapsMock.setSlippage).toHaveBeenCalledWith('1.25')
        const calls = settingsMock.setPreference.mock.calls
        expect(calls).toContainEqual(['swap-introduction-seen', true])
        expect(calls).toContainEqual(['legacy.swap.lastUsedAddress', 'ADDR_Y'])
        expect(calls).toContainEqual(['legacy.swap.useLocalCurrency', true])
    })
})
