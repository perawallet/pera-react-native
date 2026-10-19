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

// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import { deeplinkAdapters } from '../chain-adapter'
import { DeeplinkType, linkTargetOf } from '../links'
import { parseDeeplink } from '../parser'
import { PERA_LINK_CHAIN_ID, peraLinkChainFailure } from '../pera-link-chain'
import {
    EVM_LINK_CAIP2,
    EVM_LINK_CHAIN_ID,
    PERA_LINK_TESTNET_CAIP2,
    registerPeraLinkChains,
} from './peraLinkChain'

const ALGORAND_ADDRESS =
    '5CYNWZY5JO7RWAPEQLWOTDULMDSSKJ55PHXNRTGZXUR62B7PR7JIDJGHEA'
const EVM_ADDRESS = '0x52908400098527886E0F7030069857D2E4169EE7'
const ERC20 = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const UNKNOWN_CAIP2 = 'eip155:999999'

describe('Pera links with chain=', () => {
    beforeEach(() => {
        registerPeraLinkChains()
    })

    afterEach(() => {
        addressCodecs.reset()
        deeplinkAdapters.reset()
        getProvider().chains.reset()
    })

    it('adds a contact on the chain the link names', () => {
        const link = parseDeeplink(
            `perawallet://app/add-contact/?chain=${EVM_LINK_CAIP2}&address=${EVM_ADDRESS}&label=Vitalik`,
        )

        expect(link).toEqual({
            type: DeeplinkType.ADD_CONTACT,
            sourceUrl: expect.any(String),
            target: { chainId: EVM_LINK_CHAIN_ID, networkId: 'mainnet' },
            address: EVM_ADDRESS,
            label: 'Vitalik',
        })
    })

    it('reads a link without chain as Algorand, so a 0x address is rejected', () => {
        expect(
            parseDeeplink(
                `perawallet://app/add-contact/?address=${EVM_ADDRESS}&label=Vitalik`,
            ),
        ).toBeNull()
    })

    it("reads the asset id through the target chain's adapter", () => {
        const link = parseDeeplink(
            `perawallet://app/asset-detail/?chain=${EVM_LINK_CAIP2}&address=${EVM_ADDRESS}&assetId=${ERC20}`,
        )

        expect(link?.type).toBe(DeeplinkType.ASSET_DETAIL)
        if (link?.type === DeeplinkType.ASSET_DETAIL) {
            expect(link.assetRef).toEqual({
                chainId: EVM_LINK_CHAIN_ID,
                assetId: ERC20,
            })
        }
    })

    it("doesn't open an asset the target chain can't spell", () => {
        expect(
            parseDeeplink(
                `perawallet://app/asset-detail/?chain=${EVM_LINK_CAIP2}&address=${EVM_ADDRESS}&assetId=31566704`,
            )?.type,
        ).toBe(DeeplinkType.HOME)
    })

    it('targets the network an Algorand CAIP-2 names', () => {
        const link = parseDeeplink(
            `perawallet://app/account-detail/?chain=${PERA_LINK_TESTNET_CAIP2}&address=${ALGORAND_ADDRESS}`,
        )

        expect(link && linkTargetOf(link)).toEqual({
            chainId: PERA_LINK_CHAIN_ID,
            networkId: 'testnet',
        })
    })

    it.each([
        `perawallet://app/add-contact/?chain=${UNKNOWN_CAIP2}&address=${EVM_ADDRESS}`,
        `https://perawallet.app/qr/perawallet/app/asset-transfer/?chain=${UNKNOWN_CAIP2}&receiverAddress=${EVM_ADDRESS}`,
        `perawallet://app/swap/?chain=`,
    ])('reports an unknown CAIP-2 as unsupported-network: %s', url => {
        expect(parseDeeplink(url)).toBeNull()
        expect(peraLinkChainFailure(url)).toBe('unsupported-network')
    })

    it('reports a switched-off chain as chain-unavailable', () => {
        getProvider().chains.setCapabilityOverrides(() => ({
            chainEnabled: { [EVM_LINK_CHAIN_ID]: false },
        }))
        const url = `perawallet://app/account-detail/?chain=${EVM_LINK_CAIP2}&address=${EVM_ADDRESS}`

        expect(parseDeeplink(url)).toBeNull()
        expect(peraLinkChainFailure(url)).toBe('chain-unavailable')
    })

    it.each([
        `perawallet://app/keyreg/?chain=${EVM_LINK_CAIP2}&senderAddress=${ALGORAND_ADDRESS}`,
        `perawallet://app/shared-account-import/?chain=${UNKNOWN_CAIP2}&address=${ALGORAND_ADDRESS}`,
        `perawallet://app/asset-inbox/?chain=${EVM_LINK_CAIP2}&address=${ALGORAND_ADDRESS}`,
        `perawallet://${ALGORAND_ADDRESS}?chain=${EVM_LINK_CAIP2}`,
    ])('keeps Algorand-only links on Algorand whatever chain says: %s', url => {
        const link = parseDeeplink(url)

        expect(link && linkTargetOf(link)).toEqual({
            chainId: PERA_LINK_CHAIN_ID,
        })
        expect(peraLinkChainFailure(url)).toBeUndefined()
    })

    it('leaves a chain-agnostic path alone', () => {
        const url = `perawallet://app/discover-path/?chain=${UNKNOWN_CAIP2}&path=tokens`

        expect(parseDeeplink(url)?.type).toBe(DeeplinkType.DISCOVER_PATH)
        expect(peraLinkChainFailure(url)).toBeUndefined()
    })
})
