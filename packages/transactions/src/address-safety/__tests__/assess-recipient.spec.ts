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
    addressCodecs,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { assessRecipient } from '../assess-recipient'
import type { KnownAddress } from '../models'
import { fakeCodec } from './fakeCodecs'

const STRICT: ChainId = 'algorand'
const CASE_BLIND: ChainId = 'ethereum'

const OWN = 'OWN1AAAAAAAAAAAAOWN1'
const CONTACT = 'CON1BBBBBBBBBBBBCON1'
const RECIPIENT = 'REC1CCCCCCCCCCCCREC1'

const KNOWN: readonly KnownAddress[] = [
    { address: RECIPIENT, source: 'history' },
    { address: OWN, source: 'own-account', name: 'Main' },
    { address: CONTACT, source: 'contact', name: 'Alice' },
]

const lookAlikeOf = (address: string) =>
    `${address.slice(0, 4)}ZZZZZZZZZZZZ${address.slice(-4)}`

describe('assessRecipient', () => {
    beforeEach(() => {
        addressCodecs.reset()
        addressCodecs.register(fakeCodec(STRICT, { isCaseBlind: false }))
        addressCodecs.register(fakeCodec(CASE_BLIND, { isCaseBlind: true }))
    })

    it.each([
        [OWN, 'own-account'],
        [CONTACT, 'contact'],
        [RECIPIENT, 'history'],
    ] as const)('passes %s quietly as a known %s', (recipient, source) => {
        expect(
            assessRecipient({
                recipient,
                chainId: STRICT,
                knownAddresses: KNOWN,
            }),
        ).toEqual({ kind: 'known', source })
    })

    it.each([OWN, CONTACT, RECIPIENT])(
        'flags a look-alike of %s with the address it resembles',
        known => {
            const assessment = assessRecipient({
                recipient: lookAlikeOf(known),
                chainId: STRICT,
                knownAddresses: KNOWN,
            })

            expect(assessment).toEqual({
                kind: 'look-alike',
                knownAddress: KNOWN.find(entry => entry.address === known),
            })
        },
    )

    it('treats a case-only difference as the same address on a case-blind chain', () => {
        expect(
            assessRecipient({
                recipient: CONTACT.toLowerCase(),
                chainId: CASE_BLIND,
                knownAddresses: KNOWN,
            }),
        ).toEqual({ kind: 'known', source: 'contact' })
    })

    it('treats a case-only difference as a different address on a strict chain', () => {
        expect(
            assessRecipient({
                recipient: CONTACT.toLowerCase(),
                chainId: STRICT,
                knownAddresses: KNOWN,
            }).kind,
        ).toBe('first-send')
    })

    it('prefers an own account over a contact or history when several resemble', () => {
        const shared = [
            { address: 'SAME111111111111XEND', source: 'history' },
            { address: 'SAME222222222222XEND', source: 'contact', name: 'B' },
            { address: 'SAME333333333333XEND', source: 'own-account' },
        ] as const satisfies readonly KnownAddress[]

        const assessment = assessRecipient({
            recipient: 'SAME444444444444XEND',
            chainId: STRICT,
            knownAddresses: shared,
        })

        expect(assessment).toEqual({
            kind: 'look-alike',
            knownAddress: shared[2],
        })
    })

    it('flags a look-alike of a watched account, after own accounts and before contacts', () => {
        const knownAddresses: readonly KnownAddress[] = [
            { address: 'SAME222222222222XEND', source: 'contact', name: 'B' },
            {
                address: 'SAME555555555555XEND',
                source: 'watched-account',
                name: 'Cold',
            },
        ]

        expect(
            assessRecipient({
                recipient: 'SAME444444444444XEND',
                chainId: STRICT,
                knownAddresses,
            }),
        ).toEqual({ kind: 'look-alike', knownAddress: knownAddresses[1] })
        expect(
            assessRecipient({
                recipient: 'SAME444444444444XEND',
                chainId: STRICT,
                knownAddresses: [
                    ...knownAddresses,
                    { address: 'SAME333333333333XEND', source: 'own-account' },
                ],
            }),
        ).toMatchObject({
            kind: 'look-alike',
            knownAddress: { source: 'own-account' },
        })
    })

    it('lets an exact match on a counterparty the account paid win over a look-alike', () => {
        const knownAddresses: readonly KnownAddress[] = [
            { address: lookAlikeOf(OWN), source: 'history' },
            { address: OWN, source: 'own-account' },
        ]

        expect(
            assessRecipient({
                recipient: lookAlikeOf(OWN),
                chainId: STRICT,
                knownAddresses,
            }),
        ).toEqual({ kind: 'known', source: 'history' })
    })

    it.each([OWN, CONTACT, RECIPIENT])(
        'flags a counterparty that only ever paid the account when it resembles %s',
        vouched => {
            const payer: KnownAddress = {
                address: lookAlikeOf(vouched),
                source: 'history',
                isInboundOnly: true,
            }
            const knownAddresses = [...KNOWN, payer]

            expect(
                assessRecipient({
                    recipient: payer.address,
                    chainId: STRICT,
                    knownAddresses,
                }),
            ).toEqual({
                kind: 'look-alike',
                knownAddress: KNOWN.find(entry => entry.address === vouched),
            })
        },
    )

    it('passes a counterparty that only ever paid the account when it resembles nothing vouched for', () => {
        const payer: KnownAddress = {
            address: 'PAY1DDDDDDDDDDDDPAY1',
            source: 'history',
            isInboundOnly: true,
        }
        const otherPayer: KnownAddress = {
            address: 'PAY1EEEEEEEEEEEEPAY1',
            source: 'history',
            isInboundOnly: true,
        }

        expect(
            assessRecipient({
                recipient: payer.address,
                chainId: STRICT,
                knownAddresses: [...KNOWN, payer, otherPayer],
            }),
        ).toEqual({ kind: 'known', source: 'history' })
    })

    it('lets a vouched-for entry for the same address outweigh its inbound-only one', () => {
        const knownAddresses: readonly KnownAddress[] = [
            {
                address: lookAlikeOf(OWN),
                source: 'history',
                isInboundOnly: true,
            },
            { address: lookAlikeOf(OWN), source: 'contact', name: 'Bob' },
            { address: OWN, source: 'own-account' },
        ]

        expect(
            assessRecipient({
                recipient: lookAlikeOf(OWN),
                chainId: STRICT,
                knownAddresses,
            }),
        ).toEqual({ kind: 'known', source: 'contact' })
    })

    it('reports a first send when nothing known resembles the recipient', () => {
        expect(
            assessRecipient({
                recipient: 'NEW1DDDDDDDDDDDDNEW1',
                chainId: STRICT,
                knownAddresses: KNOWN,
            }),
        ).toEqual({ kind: 'first-send' })
    })

    it('reports a first send when nothing is known at all', () => {
        expect(
            assessRecipient({
                recipient: RECIPIENT,
                chainId: STRICT,
                knownAddresses: [],
            }),
        ).toEqual({ kind: 'first-send' })
    })
})
