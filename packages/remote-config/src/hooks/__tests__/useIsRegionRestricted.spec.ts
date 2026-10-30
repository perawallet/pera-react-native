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

import { describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    useIsRegionRestricted,
    useRegionRestrictedFeatures,
} from '../useIsRegionRestricted'

const { config } = vi.hoisted(() => ({ config: { value: '' } }))

vi.mock('../useRemoteConfig', () => ({
    useRemoteConfig: () => ({
        getStringValue: () => config.value,
    }),
}))

const onDeviceIn = (country: string): void => {
    vi.mocked(getProvider).mockReturnValue({
        deviceInfo: { getDeviceCountry: () => country },
    } as unknown as ReturnType<typeof getProvider>)
}

describe('useRegionRestrictedFeatures', () => {
    test('lists every feature restricted in the device region, Discover-only ones included', () => {
        onDeviceIn('GB')
        config.value = '{"GB": ["crypto_promotion", "markets_beta"]}'

        const { result } = renderHook(() => useRegionRestrictedFeatures())

        expect(result.current).toEqual(['crypto_promotion', 'markets_beta'])
    })

    test('keeps the same array until the features change', () => {
        onDeviceIn('GB')
        config.value = '{"GB": ["swap"]}'
        const { result, rerender } = renderHook(() =>
            useRegionRestrictedFeatures(),
        )
        const first = result.current

        rerender()

        expect(result.current).toBe(first)
    })
})

describe('useIsRegionRestricted', () => {
    test('restricts only the listed feature', () => {
        onDeviceIn('GB')
        config.value = '{"GB": ["xo_swap"]}'

        expect(
            renderHook(() => useIsRegionRestricted('xo_swap')).result.current,
        ).toBe(true)
        expect(
            renderHook(() => useIsRegionRestricted('swap')).result.current,
        ).toBe(false)
    })
})
