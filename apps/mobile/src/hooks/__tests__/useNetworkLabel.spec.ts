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
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { algorandDescriptor } from '@perawallet/wallet-core-chain-algorand/descriptor'
import { useNetworkLabel } from '@hooks/useNetworkLabel'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => `t:${key}` }),
}))

describe('useNetworkLabel', () => {
    it.each(algorandDescriptor.networks.map(network => network.id))(
        'has a translated label for declared network %s',
        networkId => {
            const { result } = renderHook(() => useNetworkLabel())

            expect(result.current(networkId)).toBe(
                `t:common.network_label.${networkId}`,
            )
        },
    )

    it('labels the custom node slot', () => {
        const { result } = renderHook(() => useNetworkLabel())

        expect(result.current('custom')).toBe('t:common.network_label.custom')
    })

    it('falls back to the raw id for an unknown network', () => {
        const { result } = renderHook(() => useNetworkLabel())

        expect(result.current('fnet')).toBe('fnet')
    })
})
