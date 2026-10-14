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
import {
    algorandAccountAt,
    registerAlgorandRampAdapter,
} from '@test-utils/rampChainAdapter'
import { useCanFundAccount } from '../useCanFundAccount'

describe('useCanFundAccount', () => {
    beforeEach(() => {
        useRemoteConfigStore.getState().resetState()
        registerAlgorandRampAdapter()
    })

    it("follows the onramp capability of the account's chain", () => {
        const account = algorandAccountAt('ALGORAND_ADDRESS')
        const { result, rerender } = renderHook(() =>
            useCanFundAccount(account),
        )
        expect(result.current).toBe(true)

        setCapabilityOverrides({ onramp: false })
        rerender()

        expect(result.current).toBe(false)
    })

    it('is false for an account with no address on an onramp chain', () => {
        const { result } = renderHook(() =>
            useCanFundAccount({
                id: 'elsewhere',
                custody: { kind: 'watch' },
                chains: { ethereum: { address: '0xADDRESS' } },
            }),
        )

        expect(result.current).toBe(false)
    })

    it('is false without an account', () => {
        const { result } = renderHook(() => useCanFundAccount(null))

        expect(result.current).toBe(false)
    })
})
