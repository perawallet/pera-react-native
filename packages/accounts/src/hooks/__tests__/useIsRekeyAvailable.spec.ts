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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useIsRekeyAvailable } from '../useIsRekeyAvailable'

const mocks = vi.hoisted(() => ({
    isRekeyEnabled: true,
    supportsRekey: true,
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useChainCapability: () => mocks.isRekeyEnabled,
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        chains: {
            get: () => ({
                descriptor: { supportsRekey: mocks.supportsRekey },
            }),
        },
    }),
}))

describe('useIsRekeyAvailable', () => {
    beforeEach(() => {
        mocks.isRekeyEnabled = true
        mocks.supportsRekey = true
    })

    it('holds when the chain supports rekey and the capability is on', () => {
        const { result } = renderHook(() => useIsRekeyAvailable('algorand'))

        expect(result.current).toBe(true)
    })

    it('is false when the chain cannot rekey, whatever the capability says', () => {
        mocks.supportsRekey = false

        const { result } = renderHook(() => useIsRekeyAvailable('algorand'))

        expect(result.current).toBe(false)
    })

    it('is false when the capability is off', () => {
        mocks.isRekeyEnabled = false

        const { result } = renderHook(() => useIsRekeyAvailable('algorand'))

        expect(result.current).toBe(false)
    })
})
