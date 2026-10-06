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
import {
    FAKE_NATIVE_ASSET,
    registerFakeAssetsAdapter,
} from '../../__tests__/fakeAssetsChain'
import { useIsNativeAssetId } from '../useIsNativeAssetId'

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

describe('useIsNativeAssetId', () => {
    beforeEach(() => {
        registerFakeAssetsAdapter()
    })

    it('matches the native id in every shape an id arrives in', () => {
        const { result } = renderHook(() => useIsNativeAssetId())
        const native = FAKE_NATIVE_ASSET.assetId

        expect(result.current(native)).toBe(true)
        expect(result.current(Number(native))).toBe(true)
        expect(result.current(BigInt(native))).toBe(true)
    })

    it('rejects other ids and a missing id', () => {
        const { result } = renderHook(() => useIsNativeAssetId())

        expect(result.current('31566704')).toBe(false)
        expect(result.current(31566704n)).toBe(false)
        expect(result.current(null)).toBe(false)
        expect(result.current(undefined)).toBe(false)
    })

    it('returns the same predicate across renders', () => {
        const { result, rerender } = renderHook(() => useIsNativeAssetId())
        const first = result.current

        rerender()

        expect(result.current).toBe(first)
    })
})
