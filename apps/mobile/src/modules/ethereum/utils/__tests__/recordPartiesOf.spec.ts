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
import type {
    TransactionRecord,
    TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import { recordPartiesOf } from '../recordPartiesOf'

const ME = '0x00000000000000000000000000000000000000aa'
const PEER = '0x00000000000000000000000000000000000000bb'

const recordOf = (
    summary: Partial<TransactionSummary>,
    initiator?: string,
): TransactionRecord =>
    ({
        id: '0x1',
        scope: { chainId: 'ethereum', networkId: 'mainnet' },
        status: 'confirmed',
        initiator,
        summary: { kind: 'transfer', direction: 'out', ...summary },
        chainData: { family: 'evm' },
    }) as unknown as TransactionRecord

describe('recordPartiesOf', () => {
    it('Given a payment sent, then it is from the account to the counterparty', () => {
        expect(
            recordPartiesOf(recordOf({ counterparty: PEER }, ME), ME),
        ).toEqual({ from: ME, to: PEER })
    })

    it('Given a payment received, then it is from the counterparty to the account, and inbound', () => {
        expect(
            recordPartiesOf(
                recordOf({ direction: 'in', counterparty: PEER }, PEER),
                ME,
            ),
        ).toEqual({ from: PEER, to: ME })
    })

    it('Given a transfer to itself, then both parties are the account', () => {
        expect(
            recordPartiesOf(recordOf({ direction: 'self' }, ME), ME),
        ).toEqual({ from: ME, to: ME })
    })

    it('Given a self-send as the history reports it, naming its own address as counterparty and initiator, then both parties are the account', () => {
        expect(
            recordPartiesOf(
                recordOf({ direction: 'self', counterparty: ME }, ME),
                ME,
            ),
        ).toEqual({ from: ME, to: ME })
    })

    it("Given a call another party made, then it is inbound even though the summary doesn't say 'in'", () => {
        const parties = recordPartiesOf(
            recordOf(
                { direction: 'none', counterparty: PEER.toUpperCase() },
                PEER,
            ),
            ME,
        )

        expect(parties).toEqual({ from: PEER.toUpperCase(), to: ME })
    })

    it('Given no initiator, then a sent record falls back to the account as the sender', () => {
        expect(recordPartiesOf(recordOf({ counterparty: PEER }), ME).from).toBe(
            ME,
        )
    })

    it('Given no initiator and no direction, then the sender is left unknown', () => {
        expect(
            recordPartiesOf(
                recordOf({ direction: 'none', counterparty: PEER }),
                ME,
            ).from,
        ).toBeUndefined()
    })

    it('Given no account address, then an inbound record names no recipient', () => {
        expect(
            recordPartiesOf(
                recordOf({ direction: 'in', counterparty: PEER }, PEER),
                '',
            ).to,
        ).toBeUndefined()
    })
})
