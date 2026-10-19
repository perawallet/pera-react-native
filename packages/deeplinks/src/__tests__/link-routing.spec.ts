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
    type NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import {
    FIXTURE_CHAIN_ID,
    fixtureCodec,
} from '@perawallet/wallet-core-chain-contract/testing'
import { deeplinkAdapters } from '../chain-adapter'
import { DeeplinkType, type AnyParsedDeeplink } from '../links'
import {
    addressCandidatesOf,
    isUnsupportedChainLink,
    linkNetworkMismatchOf,
} from '../link-routing'
import { fakeDeeplinkAdapter } from './fakeDeeplinkAdapter'

const A = FIXTURE_CHAIN_ID
const B = 'fixturetwo' as ChainId

const codecB: AddressCodec = {
    ...fixtureCodec,
    chainId: B,
    isValid: address => /^fx[0-9a-f]{40}$/.test(address.toLowerCase()),
}

const sharedAddress = `fx${'a'.repeat(40)}`

const switchOff = (chainId: ChainId): void => {
    getProvider().chains.setCapabilityOverrides(() => ({
        chainEnabled: { [chainId]: false },
    }))
}

describe('link routing', () => {
    beforeEach(() => {
        deeplinkAdapters.register(
            fakeDeeplinkAdapter(A, ['fixturehex'], fixtureCodec),
        )
        addressCodecs.register(fixtureCodec)
    })

    afterEach(() => {
        deeplinkAdapters.reset()
        addressCodecs.reset()
        getProvider().chains.setCapabilityOverrides(() => ({}))
    })

    describe('isUnsupportedChainLink', () => {
        it('is true for a link its switched-off chain claims', () => {
            switchOff(A)

            expect(isUnsupportedChainLink(`fixturehex:${sharedAddress}`)).toBe(
                true,
            )
        })

        it('is false for a link its chain cannot read', () => {
            expect(isUnsupportedChainLink('fixturehex:nope')).toBe(false)
        })

        it('is false for a link its chain reads', () => {
            expect(isUnsupportedChainLink(`fixturehex:${sharedAddress}`)).toBe(
                false,
            )
        })
    })

    describe('addressCandidatesOf', () => {
        it('lists every chain whose codec accepts a raw address', () => {
            addressCodecs.register(codecB)

            expect(addressCandidatesOf(sharedAddress)).toEqual({
                address: sharedAddress,
                chainIds: [A, B],
            })
        })

        it('has no candidates when only one chain accepts the address', () => {
            expect(addressCandidatesOf(sharedAddress)).toBeUndefined()
        })

        it('has no candidates for a link a scheme owns', () => {
            addressCodecs.register(codecB)

            expect(
                addressCandidatesOf(`fixturehex:${sharedAddress}`),
            ).toBeUndefined()
        })
    })
})

describe('linkNetworkMismatchOf', () => {
    const transferOn = (networkId?: NetworkId): AnyParsedDeeplink => ({
        type: DeeplinkType.TRANSFER,
        sourceUrl: 'fixturehex:x',
        target: { chainId: A, ...(networkId && { networkId }) },
        receiverAddress: sharedAddress,
    })
    const selectedNetworkOf = vi.fn(() => 'mainnet' as NetworkId)

    it('returns the target of a link naming another network', () => {
        expect(
            linkNetworkMismatchOf(
                transferOn('testnet' as NetworkId),
                selectedNetworkOf,
            ),
        ).toEqual({ chainId: A, networkId: 'testnet' })
        expect(selectedNetworkOf).toHaveBeenCalledWith(A)
    })

    it('passes a link naming the selected network', () => {
        expect(
            linkNetworkMismatchOf(
                transferOn('mainnet' as NetworkId),
                selectedNetworkOf,
            ),
        ).toBeUndefined()
    })

    it('passes a link naming no network', () => {
        expect(
            linkNetworkMismatchOf(transferOn(), selectedNetworkOf),
        ).toBeUndefined()
    })

    it('passes a link that names no chain', () => {
        expect(
            linkNetworkMismatchOf(
                { type: DeeplinkType.HOME, sourceUrl: 'perawallet://app' },
                selectedNetworkOf,
            ),
        ).toBeUndefined()
    })
})
