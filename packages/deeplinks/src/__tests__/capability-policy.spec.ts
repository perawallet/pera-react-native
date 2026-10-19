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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type {
    ChainDescriptor,
    ChainId,
} from '@perawallet/wallet-core-chain-contract'
import {
    chainRequirementOf,
    unsupportedLinkChainOf,
} from '../capability-policy'
import { DeeplinkType, type AnyParsedDeeplink } from '../links'

const CHAIN = 'fixturehex' as ChainId

const optInOn = (chainId: ChainId): AnyParsedDeeplink => ({
    type: DeeplinkType.ASSET_OPT_IN,
    sourceUrl: 'fixturehex:x',
    target: { chainId },
    assetRef: { chainId, assetId: '1' },
})

const registerChain = (requiresAssetOptIn: boolean) => {
    const { chains } = getProvider()
    vi.spyOn(chains, 'has').mockReturnValue(true)
    vi.spyOn(chains, 'get').mockReturnValue({
        descriptor: { protocol: { requiresAssetOptIn } } as ChainDescriptor,
    })
}

describe('chainRequirementOf', () => {
    it("binds a chain-scoped type's capability to the link's chain", () => {
        expect(
            chainRequirementOf({
                type: DeeplinkType.TRANSFER,
                sourceUrl: 'fixturehex:x',
                target: { chainId: CHAIN },
                receiverAddress: 'x',
            }),
        ).toEqual({ chain: { chainId: CHAIN, capability: 'send' } })
    })

    it('checks a type that names no chain against any chain', () => {
        expect(
            chainRequirementOf({
                type: DeeplinkType.STAKING,
                sourceUrl: 'perawallet://app/staking',
            }),
        ).toEqual({ anyChain: 'staking' })
    })

    it('needs nothing for a navigation-only type', () => {
        expect(
            chainRequirementOf({
                type: DeeplinkType.HOME,
                sourceUrl: 'perawallet://app',
            }),
        ).toBeNull()
    })
})

describe('unsupportedLinkChainOf', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('names the chain of an opt-in whose assets need none', () => {
        registerChain(false)

        expect(unsupportedLinkChainOf(optInOn(CHAIN))).toBe(CHAIN)
    })

    it('passes an opt-in on a chain that requires opt-in', () => {
        registerChain(true)

        expect(unsupportedLinkChainOf(optInOn(CHAIN))).toBeUndefined()
    })

    it('passes every other type', () => {
        registerChain(false)

        expect(
            unsupportedLinkChainOf({
                type: DeeplinkType.TRANSFER,
                sourceUrl: 'fixturehex:x',
                target: { chainId: CHAIN },
                receiverAddress: 'x',
            }),
        ).toBeUndefined()
    })
})
