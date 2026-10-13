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
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import {
    algorandAccountAt,
    registerAlgorandRampAdapter,
} from '@test-utils/rampChainAdapter'
import { useOnrampAccount } from '../useOnrampAccount'

describe('useOnrampAccount', () => {
    beforeEach(() => {
        useRemoteConfigStore.getState().resetState()
        vi.mocked(useSelectedAccount).mockReturnValue(null)
        registerAlgorandRampAdapter()
    })

    it("buys onto the account's chain at its address", () => {
        vi.mocked(useSelectedAccount).mockReturnValue(algorandAccountAt('ALGORAND_ADDRESS'))

        const { result } = renderHook(() => useOnrampAccount())

        expect(result.current.scope).toEqual({
            chainId: 'algorand',
            networkId: 'mainnet',
        })
        expect(result.current.address).toBe('ALGORAND_ADDRESS')
        expect(result.current.account?.id).toBe('ALGORAND_ADDRESS')
    })

    it("has no scope when the account's chain has onramp off", () => {
        vi.mocked(useSelectedAccount).mockReturnValue(algorandAccountAt('ALGORAND_ADDRESS'))
        setCapabilityOverrides({ onramp: false })

        const { result } = renderHook(() => useOnrampAccount())

        expect(result.current.scope).toBeNull()
        expect(result.current.address).toBeNull()
    })

    it('has no scope for an account with no address on an onramp chain', () => {
        vi.mocked(useSelectedAccount).mockReturnValue({
            id: 'elsewhere',
            custody: { kind: 'watch' },
            chains: { ethereum: { address: '0xADDRESS' } },
        })

        const { result } = renderHook(() => useOnrampAccount())

        expect(result.current.scope).toBeNull()
    })

    it('has no scope without a selected account', () => {
        const { result } = renderHook(() => useOnrampAccount())

        expect(result.current).toEqual({
            account: null,
            scope: null,
            address: null,
        })
    })
})
