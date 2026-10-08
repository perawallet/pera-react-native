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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@test-utils/render'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import { useButtonPanel } from '../useButtonPanel'

vi.mock('../../AccountOverview/AccountOverviewModalContext', () => ({
    useAccountOverviewModal: () => ({
        openSendFunds: vi.fn(),
        openReceiveFunds: vi.fn(),
        openAccountOptions: vi.fn(),
    }),
}))

describe('useButtonPanel', () => {
    beforeEach(() => {
        useRemoteConfigStore.getState().resetState()
    })

    it('offers swapping at the Algorand defaults', () => {
        const { result } = renderHook(() => useButtonPanel())

        expect(result.current.canSwap).toBe(true)
    })

    it('removes swapping when the swap capability is off', () => {
        setCapabilityOverrides({ swap: false })

        const { result } = renderHook(() => useButtonPanel())

        expect(result.current.canSwap).toBe(false)
    })
})
