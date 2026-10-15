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

import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import { linkFromIntent } from '../chain-links'
import { DeeplinkType } from '../links'
import type { ChainLinkTarget } from '../models'

const target: ChainLinkTarget = { chainId: 'fixturehex', networkId: 'testnet' }
const assetRef = { chainId: 'fixturehex', assetId: '7' }
const URL = 'fixturehex:source'

describe('linkFromIntent', () => {
    it('maps an address intent to ADDRESS_ACTIONS', () => {
        expect(
            linkFromIntent(
                { kind: 'address', target, address: 'addr', label: 'Me' },
                URL,
            ),
        ).toEqual({
            type: DeeplinkType.ADDRESS_ACTIONS,
            sourceUrl: URL,
            target,
            address: 'addr',
            label: 'Me',
        })
    })

    it('maps a payment intent to TRANSFER and keeps the Decimal amount as given', () => {
        const amount = new Decimal('1000')

        const link = linkFromIntent(
            {
                kind: 'payment',
                target,
                recipient: 'addr',
                assetRef,
                amount,
                note: 'n',
            },
            URL,
        )

        expect(link).toMatchObject({
            type: DeeplinkType.TRANSFER,
            receiverAddress: 'addr',
            assetRef,
            note: 'n',
        })
        expect(link && 'amount' in link && link.amount).toBe(amount)
    })

    it('maps an asset-opt-in intent', () => {
        expect(
            linkFromIntent({ kind: 'asset-opt-in', target, assetRef }, URL),
        ).toMatchObject({ type: DeeplinkType.ASSET_OPT_IN, assetRef, target })
    })

    it('maps an explorer intent to DISCOVER_BROWSER with its target', () => {
        expect(
            linkFromIntent(
                { kind: 'explorer', target, url: 'https://explorer.test/a/1' },
                URL,
            ),
        ).toMatchObject({
            type: DeeplinkType.DISCOVER_BROWSER,
            url: 'https://explorer.test/a/1',
            target,
        })
    })

    it('maps a wallet-connect intent through the WalletConnect parser', () => {
        const uri = `wc:${'c'.repeat(64)}@2?symKey=${'d'.repeat(64)}`

        expect(linkFromIntent({ kind: 'wallet-connect', uri }, URL)).toEqual({
            type: DeeplinkType.WALLET_CONNECT,
            sourceUrl: URL,
            uri,
            browserName: undefined,
        })
    })

    it('returns null for a wallet-connect intent the WalletConnect layer refuses', () => {
        expect(
            linkFromIntent(
                { kind: 'wallet-connect', uri: 'wc://?browser=x' },
                URL,
            ),
        ).toBeNull()
        expect(
            linkFromIntent({ kind: 'wallet-connect', uri: 'not-a-uri' }, URL),
        ).toBeNull()
    })

    it('maps a chain-action intent to CHAIN_ACTION', () => {
        const chainData = {
            family: 'algorand',
            action: 'keyreg',
            sender: 'addr',
            keyregType: 'offline',
        } as const

        expect(
            linkFromIntent({ kind: 'chain-action', target, chainData }, URL),
        ).toEqual({
            type: DeeplinkType.CHAIN_ACTION,
            sourceUrl: URL,
            target,
            chainData,
        })
    })
})
