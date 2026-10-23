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
    CHAIN_IDS,
    isEvmChainId,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { useChainIcon } from '../useChainIcon'

const registered = vi.hoisted(
    () => new Map<string, { displayName: string; family: string }>(),
)

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        chains: {
            has: (id: string) => registered.has(id),
            get: (id: string) => ({ descriptor: registered.get(id) }),
        },
    }),
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    chainDisplayNameOf: (id: string) => registered.get(id)?.displayName,
}))

const iconOf = (chainId: ChainId) =>
    renderHook(() => useChainIcon(chainId)).result.current.Icon

describe('useChainIcon', () => {
    beforeEach(() => {
        registered.clear()
        for (const id of CHAIN_IDS) {
            registered.set(id, {
                displayName: id,
                family: isEvmChainId(id) ? 'evm' : id,
            })
        }
    })

    it('resolves every registered chain to an icon', () => {
        const missing = CHAIN_IDS.filter(id => !iconOf(id))

        expect(missing).toEqual([])
    })

    it("gives each EVM chain its own icon, never Ethereum's", () => {
        const icons = CHAIN_IDS.filter(isEvmChainId).map(iconOf)

        expect(new Set(icons).size).toBe(icons.length)
    })

    it('falls back to initials for a chain registered without an icon', () => {
        registered.set('zksync', { displayName: 'ZKsync Era', family: 'evm' })

        const { result } = renderHook(() => useChainIcon('zksync' as ChainId))

        expect(result.current).toEqual({
            Icon: undefined,
            initials: 'ZE',
            displayName: 'ZKsync Era',
        })
    })

    it('falls back to initials for a family with no icons', () => {
        registered.set('solana', { displayName: 'Solana', family: 'solana' })

        const { result } = renderHook(() => useChainIcon('solana' as ChainId))

        expect(result.current.Icon).toBeUndefined()
        expect(result.current.initials).toBe('S')
    })
})
