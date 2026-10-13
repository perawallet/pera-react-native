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
import { useNoFundsButtonPanel } from '../useNoFundsButtonPanel'

vi.mock('../../AccountOverview/AccountOverviewModalContext', () => ({
    useAccountOverviewModal: () => ({
        openReceiveFunds: vi.fn(),
        openAccountOptions: vi.fn(),
    }),
}))

describe('useNoFundsButtonPanel', () => {
    beforeEach(() => {
        useRemoteConfigStore.getState().resetState()
    })

    it('offers buying at the Algorand defaults', () => {
        const { result } = renderHook(() => useNoFundsButtonPanel())

        expect(result.current.canBuy).toBe(true)
    })

    it('removes buying when the onramp capability is off', () => {
        setCapabilityOverrides({ onramp: false })

        const { result } = renderHook(() => useNoFundsButtonPanel())

        expect(result.current.canBuy).toBe(false)
    })
})
