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
import { useIsDelegationAvailable } from '../useIsDelegationAvailable'
import {
    FAKE_CHAIN_ID,
    fakeAccountsChain,
    registerFakeAccountsChain,
} from '../../__tests__/fakeAccountsChain'

const mocks = vi.hoisted(() => ({
    isOn: true,
    check: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useChainCapabilityCheck: () => (requirement: unknown) => {
        mocks.check(requirement)
        return mocks.isOn
    },
}))

describe('useIsDelegationAvailable', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isOn = true
        registerFakeAccountsChain()
    })

    it('holds when the chain declares delegation and its capability is on', () => {
        const { result } = renderHook(() =>
            useIsDelegationAvailable(FAKE_CHAIN_ID),
        )

        expect(result.current).toBe(true)
    })

    it("checks the capability the chain's authority declares", () => {
        const { authority } = fakeAccountsChain().adapter

        renderHook(() => useIsDelegationAvailable(FAKE_CHAIN_ID))

        expect(mocks.check).toHaveBeenCalledWith({
            chain: {
                chainId: FAKE_CHAIN_ID,
                capability: authority!.capability,
            },
        })
    })

    it('is false when the capability is off', () => {
        mocks.isOn = false

        const { result } = renderHook(() =>
            useIsDelegationAvailable(FAKE_CHAIN_ID),
        )

        expect(result.current).toBe(false)
    })

    it('is false on a chain that declares no delegation, whatever the capability says', () => {
        registerFakeAccountsChain({ authority: undefined })

        const { result } = renderHook(() =>
            useIsDelegationAvailable(FAKE_CHAIN_ID),
        )

        expect(result.current).toBe(false)
    })
})
