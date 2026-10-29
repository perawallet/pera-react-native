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
import { renderHook } from '@testing-library/react'
import {
    useAccountChainId,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useSendFundsStore } from '../useSendFunds'
import { useSendScope } from '../useSendScope'

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(),
    useAccountChainId: vi.fn(),
}))

const TWO_CHAIN_ACCOUNT = {
    id: 'two-chain',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: 'ALGO' },
        ethereum: { address: '0xabc' },
    },
}

describe('useSendScope', () => {
    beforeEach(() => {
        useSendFundsStore.getState().reset()
        vi.mocked(useSelectedAccount).mockReturnValue(
            TWO_CHAIN_ACCOUNT as never,
        )
        vi.mocked(useAccountChainId).mockReturnValue('algorand')
    })

    it("runs the send on the selected asset's chain, not the account's first", () => {
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'ethereum', assetId: 'native' })

        const { result } = renderHook(() => useSendScope())

        expect(result.current.chainId).toBe('ethereum')
    })

    it('runs the send on the chosen network before an asset is picked', () => {
        useSendFundsStore.getState().setChainId('ethereum')

        const { result } = renderHook(() => useSendScope())

        expect(result.current.chainId).toBe('ethereum')
    })

    it("keeps the selected asset's chain over the chosen network", () => {
        useSendFundsStore.getState().setChainId('ethereum')
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'algorand', assetId: '0' })

        const { result } = renderHook(() => useSendScope())

        expect(result.current.chainId).toBe('algorand')
    })

    it("falls back to the account's chain before a network or asset is picked", () => {
        const { result } = renderHook(() => useSendScope())

        expect(useAccountChainId).toHaveBeenCalledWith(
            TWO_CHAIN_ACCOUNT,
            'algorand',
        )
        expect(result.current.chainId).toBe('algorand')
    })
})
