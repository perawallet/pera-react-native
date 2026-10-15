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

import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findNativeAsset } from '@perawallet/wallet-core-assets'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { setChainEnabled } from '@test-utils/capability-overrides'
import { useChainAvailability } from '../useChainAvailability'

describe('useChainAvailability', () => {
    beforeEach(() => {
        useRemoteConfigStore.getState().resetState()
    })

    it("carries the chain's native asset while it can be shown", () => {
        const { result } = renderHook(() => useChainAvailability('algorand'))

        expect(result.current).toEqual({
            isAvailable: true,
            nativeAsset: findNativeAsset('algorand'),
        })
    })

    it("is unavailable while the chain's kill switch is on", () => {
        const { result } = renderHook(() => useChainAvailability('algorand'))

        act(() => setChainEnabled('algorand', false))

        expect(result.current).toEqual({ isAvailable: false })
    })

    it('is unavailable when this build has no native asset for the chain', () => {
        vi.mocked(findNativeAsset).mockReturnValueOnce(undefined)

        const { result } = renderHook(() => useChainAvailability('algorand'))

        expect(result.current).toEqual({ isAvailable: false })
    })
})
