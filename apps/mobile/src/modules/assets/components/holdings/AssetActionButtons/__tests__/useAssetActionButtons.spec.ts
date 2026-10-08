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

import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook } from '@test-utils/render'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import { useAssetActionButtons } from '../useAssetActionButtons'

describe('useAssetActionButtons', () => {
    beforeEach(() => {
        useRemoteConfigStore.getState().resetState()
    })

    it('offers both actions at the Algorand defaults', () => {
        const { result } = renderHook(() => useAssetActionButtons())

        expect(result.current).toEqual({ canSwap: true, canBuy: true })
    })

    it.each([
        ['swap', { canSwap: false, canBuy: true }],
        ['onramp', { canSwap: true, canBuy: false }],
    ] as const)(
        'drops only the action whose %s capability is off',
        (capability, expected) => {
            setCapabilityOverrides({ [capability]: false })

            const { result } = renderHook(() => useAssetActionButtons())

            expect(result.current).toEqual(expected)
        },
    )
})
