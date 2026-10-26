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
import { nftSendSubtitle, sendSummary } from '../summary'

const FROM = '0x00000000000000000000000000000000000000aA'
const TO = '0x00000000000000000000000000000000000000bb'
const NFT_AMOUNT = {
    assetRef: {
        chainId: 'ethereum' as const,
        assetId: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D/7',
    },
    value: new Decimal(1),
}

describe('nftSendSubtitle', () => {
    it('names the collection and token id with the NFT subtitle key', () => {
        expect(nftSendSubtitle('Apes', '7')).toEqual({
            key: 'transactions.list_item.nft_subtitle',
            params: { collection: 'Apes', tokenId: '7' },
        })
    })
})

describe('sendSummary', () => {
    it('carries the subtitle an NFT send passes', () => {
        const subtitle = nftSendSubtitle('Apes', '7')

        expect(
            sendSummary('nft-transfer', FROM, TO, NFT_AMOUNT, subtitle),
        ).toEqual({
            kind: 'nft-transfer',
            title: { key: 'transactions.list_item.send' },
            direction: 'out',
            icon: 'send',
            counterparty: TO,
            subtitle,
            amount: NFT_AMOUNT,
        })
    })

    it('is a self send to the same address in another case', () => {
        expect(
            sendSummary(
                'nft-transfer',
                FROM,
                FROM.toLowerCase(),
                NFT_AMOUNT,
                nftSendSubtitle('Apes', '7'),
            ),
        ).toMatchObject({
            kind: 'nft-transfer',
            direction: 'self',
            icon: 'self',
        })
    })

    it('has no subtitle key when none is passed', () => {
        expect(
            sendSummary('transfer', FROM, TO, NFT_AMOUNT),
        ).not.toHaveProperty('subtitle')
    })
})
