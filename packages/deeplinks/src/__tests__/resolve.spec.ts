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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    addressCodecs,
    type AddressCodec,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import {
    FIXTURE_CHAIN_ID,
    fixtureCodec,
} from '@perawallet/wallet-core-chain-contract/testing'
import { deeplinkAdapters } from '../chain-adapter'
import { resolveChainDeeplink } from '../resolve'
import { fakeDeeplinkAdapter } from './fakeDeeplinkAdapter'

const A = FIXTURE_CHAIN_ID
const B = 'fixturetwo' as ChainId

const codecA = fixtureCodec
const codecB: AddressCodec = {
    ...fixtureCodec,
    chainId: B,
    isValid: address => /^fx[0-9a-f]{40}$/.test(address.toLowerCase()),
}

const mainnetAddress = `fx${'a'.repeat(40)}`
const testnetAddress = `tfx${'b'.repeat(40)}`

const switchOff = (...chainIds: ChainId[]): void => {
    getProvider().chains.setCapabilityOverrides(() => ({
        chainEnabled: Object.fromEntries(chainIds.map(id => [id, false])),
    }))
}

describe('resolveChainDeeplink', () => {
    const adapterA = fakeDeeplinkAdapter(A, ['fixturehex'], codecA)
    const adapterB = fakeDeeplinkAdapter(B, ['fixturetwo'], codecB)

    beforeEach(() => {
        deeplinkAdapters.register(adapterA)
        deeplinkAdapters.register(adapterB)
        addressCodecs.register(codecA)
        addressCodecs.register(codecB)
    })

    afterEach(() => {
        deeplinkAdapters.reset()
        addressCodecs.reset()
        getProvider().chains.setCapabilityOverrides(() => ({}))
        vi.restoreAllMocks()
    })

    it("resolves a scheme link through the scheme's owner", () => {
        expect(resolveChainDeeplink(`fixturehex:${mainnetAddress}`)).toEqual({
            status: 'resolved',
            intents: [
                {
                    kind: 'address',
                    target: { chainId: A },
                    address: mainnetAddress,
                },
            ],
        })
    })

    it("reports the owner's refusal reason", () => {
        expect(resolveChainDeeplink(`fixturehex:${mainnetAddress}@5`)).toEqual({
            status: 'failed',
            chainId: A,
            reason: 'unsupported-network',
        })
        expect(resolveChainDeeplink('fixturehex:nope')).toEqual({
            status: 'failed',
            chainId: A,
            reason: 'malformed',
        })
    })

    it('fails as chain-unavailable without parsing when the owner is switched off', () => {
        const parse = vi.spyOn(adapterA, 'parse')
        switchOff(A)

        expect(resolveChainDeeplink(`fixturehex:${mainnetAddress}`)).toEqual({
            status: 'failed',
            chainId: A,
            reason: 'chain-unavailable',
        })
        expect(parse).not.toHaveBeenCalled()
    })

    it('offers a raw address to every chain whose codec accepts it', () => {
        expect(resolveChainDeeplink(mainnetAddress)).toEqual({
            status: 'resolved',
            intents: [
                {
                    kind: 'address',
                    target: { chainId: A },
                    address: mainnetAddress,
                },
                {
                    kind: 'address',
                    target: { chainId: B },
                    address: mainnetAddress,
                },
            ],
        })
    })

    it('resolves a raw address only one codec accepts to that chain', () => {
        expect(resolveChainDeeplink(testnetAddress)).toEqual({
            status: 'resolved',
            intents: [
                {
                    kind: 'address',
                    target: { chainId: A },
                    address: testnetAddress,
                },
            ],
        })
    })

    it('drops a switched-off chain from the raw address candidates', () => {
        switchOff(B)

        expect(resolveChainDeeplink(mainnetAddress)).toEqual({
            status: 'resolved',
            intents: [
                {
                    kind: 'address',
                    target: { chainId: A },
                    address: mainnetAddress,
                },
            ],
        })
    })

    it('fails as chain-unavailable for an address only a switched-off chain accepts', () => {
        switchOff(A)

        expect(resolveChainDeeplink(testnetAddress)).toEqual({
            status: 'failed',
            chainId: A,
            reason: 'chain-unavailable',
        })
    })

    it('trims pasted whitespace before resolving', () => {
        expect(resolveChainDeeplink(`  ${testnetAddress}\n`)).toEqual({
            status: 'resolved',
            intents: [
                {
                    kind: 'address',
                    target: { chainId: A },
                    address: testnetAddress,
                },
            ],
        })
    })

    it.each(['', '   \n', 'unowned:abc', 'hello'])(
        'leaves %j unrecognised',
        input => {
            expect(resolveChainDeeplink(input)).toEqual({
                status: 'unrecognised',
            })
        },
    )
})
