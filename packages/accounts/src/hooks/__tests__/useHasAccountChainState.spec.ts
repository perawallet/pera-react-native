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
import { act, renderHook } from '@testing-library/react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useAccountChainStateStore } from '../../store/accountChainState'
import { useHasAccountChainState } from '../useHasAccountChainState'

const SCOPE: ChainScope = { chainId: 'base', networkId: 'mainnet' }

describe('useHasAccountChainState', () => {
    beforeEach(() => {
        useAccountChainStateStore.getState().resetState()
    })

    it('turns true for that address on that scope once a chain state is recorded', () => {
        const { result } = renderHook(() =>
            useHasAccountChainState(SCOPE, 'ADDR1'),
        )
        expect(result.current).toBe(false)

        act(() =>
            useAccountChainStateStore
                .getState()
                .setAccountChainState(SCOPE, 'ADDR1', {
                    family: 'evm',
                    nonce: { latest: 0, pending: 0 },
                }),
        )
        expect(result.current).toBe(true)

        const other = renderHook(() => useHasAccountChainState(SCOPE, 'ADDR2'))
        expect(other.result.current).toBe(false)
    })
})
