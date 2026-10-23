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
import {
    dappRequestChainAdapters,
    type DappRequestChainAdapter,
} from '@perawallet/wallet-core-connections'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    eip155ChainIds,
    eip155HexChainIdOf,
    parseEip155HexChainId,
} from '../eip1193Chains'

const adapter = (
    chainId: ChainId,
    namespace: string,
    caip2: Record<string, string>,
): DappRequestChainAdapter =>
    ({
        chainId,
        walletConnect: {
            namespace,
            caip2ChainIdFor: (networkId: string) => caip2[networkId] ?? null,
        },
    }) as unknown as DappRequestChainAdapter

describe('eip1193Chains', () => {
    beforeEach(() => {
        dappRequestChainAdapters.reset()
        dappRequestChainAdapters.register(
            adapter('algorand', 'algorand', { mainnet: 'algorand:wGHE2Pwd' }),
        )
        dappRequestChainAdapters.register(
            adapter('ethereum', 'eip155', { mainnet: 'eip155:1' }),
        )
        dappRequestChainAdapters.register(
            adapter('polygon', 'eip155', { amoy: 'eip155:80002' }),
        )
    })

    it('lists only eip155 chains, in registration order', () => {
        expect(eip155ChainIds()).toEqual(['ethereum', 'polygon'])
    })

    it('turns a network’s CAIP-2 reference into lowercase hex', () => {
        expect(
            eip155HexChainIdOf({ chainId: 'polygon', networkId: 'amoy' }),
        ).toBe('0x13882')
    })

    it('has no EIP-155 id for a non-eip155 chain, a network without CAIP-2 or an unknown chain', () => {
        expect(
            eip155HexChainIdOf({ chainId: 'algorand', networkId: 'mainnet' }),
        ).toBeNull()
        expect(
            eip155HexChainIdOf({ chainId: 'ethereum', networkId: 'custom' }),
        ).toBeNull()
        expect(
            eip155HexChainIdOf({ chainId: 'base', networkId: 'mainnet' }),
        ).toBeNull()
    })

    it('normalises a hex quantity and refuses anything else', () => {
        expect(parseEip155HexChainId('0x0A')).toBe('0xa')
        expect(parseEip155HexChainId('0x2105')).toBe('0x2105')
        expect(parseEip155HexChainId('0x')).toBeNull()
        expect(parseEip155HexChainId('8453')).toBeNull()
        expect(parseEip155HexChainId('0xzz')).toBeNull()
        expect(parseEip155HexChainId(8453)).toBeNull()
    })
})
