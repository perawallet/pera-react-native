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
import '../../__tests__/registerAlgorandAccounts'
import {
    addressCodecs,
    transactionPlanners,
} from '@perawallet/wallet-core-chain-contract'
import {
    decodeFromBase64,
    encodeToBase64,
} from '@perawallet/wallet-core-shared'
import {
    signPlannedGroupOnDevice,
    type SigningResult,
} from '@perawallet/wallet-core-signing'
import { algorandAddressCodec } from '../../accounts/address-codec'
import { encodeSignedTransaction } from '../../blockchain/utils/transact'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { assembleSignedTransaction } from '../local-key/signTransactionsWithLocalKey'
import { algorandTransactionPlanner } from '../planner'
import {
    LEDGER_ADDRESS,
    LEDGER_CASES,
    createFakeAlgorandLedger,
    ledger,
} from './ledgerGoldenFixtures'
import { payloadTransactionOf } from './transactions'

// What the Ledger signing route produced for each case before it moved onto
// the planned hardware leg: the signed bytes, the bytes the device received
// and the signatures the multisig cosign transport posts. A cosign assembles
// nothing locally, so it pins no signed bytes.
const GOLDENS: Record<
    keyof typeof LEDGER_CASES,
    { signed: string[]; deviceInput: string[]; signatures: string[] }
> = {
    single: {
        signed: [
            'gqNzaWfEQKE/eM5GuG7SNDU9DVwX0heWgvx+eH2jPhwe3exAcQ5L1yCx4pUiYvooWbrEQS1K30/1LPT1kzPmel481FjWsAWjdHhuiaNhbXQBo2ZlZc4AA6WYomZ2zQPoo2dlbqxtYWlubmV0LXYxLjCiZ2jEIMBhxNj8Hb3e0tdgS+RWjj9tBBmHrDe95LYgtas5JIrfomx2zQfQo3JjdsQgCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgqjc25kxCDqSmxj4pxSCr71UHsTLsX5lUd2rr6+e5JCHuppFEbSLKR0eXBlo3BheQ==',
        ],
        deviceInput: [
            'iaNhbXQBo2ZlZc4AA6WYomZ2zQPoo2dlbqxtYWlubmV0LXYxLjCiZ2jEIMBhxNj8Hb3e0tdgS+RWjj9tBBmHrDe95LYgtas5JIrfomx2zQfQo3JjdsQgCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgqjc25kxCDqSmxj4pxSCr71UHsTLsX5lUd2rr6+e5JCHuppFEbSLKR0eXBlo3BheQ==',
        ],
        signatures: [
            'oT94zka4btI0NT0NXBfSF5aC/H54faM+HB7d7EBxDkvXILHilSJi+ihZusRBLUrfT/Us9PWTM+Z6XjzUWNawBQ==',
        ],
    },
    group: {
        signed: [
            'gqNzaWfEQC8GxEAqwg6CDJcTZS0XrRexBapizeRqq994RVfCpA53deHMm/UMaE+deKeG4yb010mb0/++nJWiykFOsvY+aQOjdHhuiqNhbXQBo2ZlZc4AA6WYomZ2zQPoo2dlbqxtYWlubmV0LXYxLjCiZ2jEIMBhxNj8Hb3e0tdgS+RWjj9tBBmHrDe95LYgtas5JIrfo2dycMQg3BhemBRGl9PRYNzWlFNj+0s1NnmnJhuMB+Ga0t2g/VKibHbNB9CjcmN2xCAKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCqNzbmTEIOpKbGPinFIKvvVQexMuxfmVR3auvr57kkIe6mkURtIspHR5cGWjcGF5',
            'gqNzaWfEQLLv+t45YWHUvqOMwC3law36BqxQsl6HsQ8aXdAqNdBg5dYRASy67UAmGJxE8+4mR+QQtlRwuJ27WTzHHmRpyAajdHhuiqNhbXQDo2ZlZc4AA6WYomZ2zQPoo2dlbqxtYWlubmV0LXYxLjCiZ2jEIMBhxNj8Hb3e0tdgS+RWjj9tBBmHrDe95LYgtas5JIrfo2dycMQg3BhemBRGl9PRYNzWlFNj+0s1NnmnJhuMB+Ga0t2g/VKibHbNB9CjcmN2xCAKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCqNzbmTEIOpKbGPinFIKvvVQexMuxfmVR3auvr57kkIe6mkURtIspHR5cGWjcGF5',
        ],
        deviceInput: [
            'iqNhbXQBo2ZlZc4AA6WYomZ2zQPoo2dlbqxtYWlubmV0LXYxLjCiZ2jEIMBhxNj8Hb3e0tdgS+RWjj9tBBmHrDe95LYgtas5JIrfo2dycMQg3BhemBRGl9PRYNzWlFNj+0s1NnmnJhuMB+Ga0t2g/VKibHbNB9CjcmN2xCAKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCqNzbmTEIOpKbGPinFIKvvVQexMuxfmVR3auvr57kkIe6mkURtIspHR5cGWjcGF5',
            'iqNhbXQDo2ZlZc4AA6WYomZ2zQPoo2dlbqxtYWlubmV0LXYxLjCiZ2jEIMBhxNj8Hb3e0tdgS+RWjj9tBBmHrDe95LYgtas5JIrfo2dycMQg3BhemBRGl9PRYNzWlFNj+0s1NnmnJhuMB+Ga0t2g/VKibHbNB9CjcmN2xCAKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCqNzbmTEIOpKbGPinFIKvvVQexMuxfmVR3auvr57kkIe6mkURtIspHR5cGWjcGF5',
        ],
        signatures: [
            'LwbEQCrCDoIMlxNlLRetF7EFqmLN5Gqr33hFV8KkDnd14cyb9QxoT514p4bjJvTXSZvT/76claLKQU6y9j5pAw==',
            'su/63jlhYdS+o4zALeVrDfoGrFCyXoexDxpd0Co10GDl1hEBLLrtQCYYnETz7iZH5BC2VHC4nbtZPMceZGnIBg==',
        ],
    },
    rekeyed: {
        signed: [
            'g6RzZ25yxCDqSmxj4pxSCr71UHsTLsX5lUd2rr6+e5JCHuppFEbSLKNzaWfEQHSFA5biM0XYm8VU37lR+u5fuwgQzkRDIETVQJ70DorvjP351CLYT6QQwywsZSd2mIvpE3oDXqyBjInE6jm7OwqjdHhuiaNhbXQBo2ZlZc4AA6WYomZ2zQPoo2dlbqxtYWlubmV0LXYxLjCiZ2jEIMBhxNj8Hb3e0tdgS+RWjj9tBBmHrDe95LYgtas5JIrfomx2zQfQo3JjdsQgCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgqjc25kxCALCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLC6R0eXBlo3BheQ==',
        ],
        deviceInput: [
            'iaNhbXQBo2ZlZc4AA6WYomZ2zQPoo2dlbqxtYWlubmV0LXYxLjCiZ2jEIMBhxNj8Hb3e0tdgS+RWjj9tBBmHrDe95LYgtas5JIrfomx2zQfQo3JjdsQgCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgqjc25kxCALCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLC6R0eXBlo3BheQ==',
        ],
        signatures: [
            'dIUDluIzRdibxVTfuVH67l+7CBDOREMgRNVAnvQOiu+M/fnUIthPpBDDLCxlJ3aYi+kTegNerIGMicTqObs7Cg==',
        ],
    },
    swap: {
        signed: [
            'gqNzaWfEQLFHxDMOoKSwMA8x3gXPgLbO1/4XbwYgRt9d0EVFeQznQePiKo87EiSSOrdkD36/0Y7NtbUo4Zt+T9vwB3C2uA+jdHhuiqNhbXQEo2ZlZc4AA6WYomZ2zQPoo2dlbqxtYWlubmV0LXYxLjCiZ2jEIMBhxNj8Hb3e0tdgS+RWjj9tBBmHrDe95LYgtas5JIrfo2dycMQgqKwwoYxaC48tdn8MGCSfMdXFoEWy1EkJVsKlh+Dzh62ibHbNB9CjcmN2xCAKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCqNzbmTEIOpKbGPinFIKvvVQexMuxfmVR3auvr57kkIe6mkURtIspHR5cGWjcGF5',
            'gqNzaWfEQCuGxM+0C5FRoq8BfPbj71NAipG4Te7vJwg76j7PK1DLM9F0+++AxXw684t0+6V+9TisIvh1XKyzecrTfbwAIQyjdHhuiqNhbXQGo2ZlZc4AA6WYomZ2zQPoo2dlbqxtYWlubmV0LXYxLjCiZ2jEIMBhxNj8Hb3e0tdgS+RWjj9tBBmHrDe95LYgtas5JIrfo2dycMQgqKwwoYxaC48tdn8MGCSfMdXFoEWy1EkJVsKlh+Dzh62ibHbNB9CjcmN2xCAKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCqNzbmTEIOpKbGPinFIKvvVQexMuxfmVR3auvr57kkIe6mkURtIspHR5cGWjcGF5',
        ],
        deviceInput: [
            'iqNhbXQEo2ZlZc4AA6WYomZ2zQPoo2dlbqxtYWlubmV0LXYxLjCiZ2jEIMBhxNj8Hb3e0tdgS+RWjj9tBBmHrDe95LYgtas5JIrfo2dycMQgqKwwoYxaC48tdn8MGCSfMdXFoEWy1EkJVsKlh+Dzh62ibHbNB9CjcmN2xCAKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCqNzbmTEIOpKbGPinFIKvvVQexMuxfmVR3auvr57kkIe6mkURtIspHR5cGWjcGF5',
            'iqNhbXQGo2ZlZc4AA6WYomZ2zQPoo2dlbqxtYWlubmV0LXYxLjCiZ2jEIMBhxNj8Hb3e0tdgS+RWjj9tBBmHrDe95LYgtas5JIrfo2dycMQgqKwwoYxaC48tdn8MGCSfMdXFoEWy1EkJVsKlh+Dzh62ibHbNB9CjcmN2xCAKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCqNzbmTEIOpKbGPinFIKvvVQexMuxfmVR3auvr57kkIe6mkURtIspHR5cGWjcGF5',
        ],
        signatures: [
            'sUfEMw6gpLAwDzHeBc+Ats7X/hdvBiBG313QRUV5DOdB4+IqjzsSJJI6t2QPfr/Rjs21tSjhm35P2/AHcLa4Dw==',
            'K4bEz7QLkVGirwF89uPvU0CKkbhN7u8nCDvqPs8rUMsz0XT774DFfDrzi3T7pX71OKwi+HVcrLN5ytN9vAAhDA==',
        ],
    },
    cosign: {
        signed: [],
        deviceInput: [
            'iaNhbXQBo2ZlZc4AA6WYomZ2zQPoo2dlbqxtYWlubmV0LXYxLjCiZ2jEIMBhxNj8Hb3e0tdgS+RWjj9tBBmHrDe95LYgtas5JIrfomx2zQfQo3JjdsQgCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgqjc25kxCBuARg43ZZsdvmg/G9VdlfIroItx4GoA2qHvxp4vt0cM6R0eXBlo3BheQ==',
        ],
        signatures: [
            'qdRrBRs0V5O04jDmDI+rHogDltzpBBU12X4VTWme6sidANJxgMkOMFuKJuGEAVC+7O19IGMVn4azJHA4FlZ3BQ==',
        ],
    },
}

const SCOPE = { chainId: ALGORAND_CHAIN_ID, networkId: 'mainnet' } as const

const signOnLedger = async (name: keyof typeof LEDGER_CASES) => {
    const { registry, received } = createFakeAlgorandLedger()
    const result = await signPlannedGroupOnDevice({
        group: LEDGER_CASES[name],
        account: ledger as Parameters<
            typeof signPlannedGroupOnDevice
        >[0]['account'],
        scope: SCOPE,
        registry,
    })
    return { result, received }
}

const signedOf = (result: SigningResult): string[] =>
    result.signedData.type === 'signed-transactions' ||
    result.signedData.type === 'transactions'
        ? result.signedData.signed.map(signed => encodeToBase64(signed.bytes))
        : []

describe('Algorand Ledger signing keeps its bytes on the planned hardware leg', () => {
    beforeEach(() => {
        transactionPlanners.reset()
        transactionPlanners.register(algorandTransactionPlanner)
        addressCodecs.reset()
        addressCodecs.register(algorandAddressCodec)
    })

    it.each(['single', 'group', 'rekeyed', 'swap'] as const)(
        'for a %s request',
        async name => {
            const { result, received } = await signOnLedger(name)
            const golden = GOLDENS[name]

            expect(received.map(encodeToBase64)).toEqual(golden.deviceInput)
            expect(signedOf(result)).toEqual(golden.signed)
            expect(result.signers).toEqual([
                { address: LEDGER_ADDRESS, signatures: golden.signatures },
            ])
        },
    )

    it.each(['single', 'group', 'rekeyed', 'swap'] as const)(
        'for a %s request, as the Algorand envelope its device signature makes',
        async name => {
            const { result } = await signOnLedger(name)
            const { transactions } = LEDGER_CASES[name].data as {
                transactions: Parameters<typeof payloadTransactionOf>[0][]
            }

            const expected = transactions.map((unsigned, index) =>
                encodeToBase64(
                    encodeSignedTransaction(
                        assembleSignedTransaction(
                            payloadTransactionOf(unsigned),
                            {
                                sig: decodeFromBase64(
                                    GOLDENS[name].signatures[index],
                                ),
                                signerAddress: LEDGER_ADDRESS,
                            },
                        ),
                    ),
                ),
            )
            expect(signedOf(result)).toEqual(expected)
        },
    )

    it('for a multisig cosign, which hands the backend the same signatures', async () => {
        const { result, received } = await signOnLedger('cosign')

        expect(received.map(encodeToBase64)).toEqual(GOLDENS.cosign.deviceInput)
        expect(result.signers).toEqual([
            { address: LEDGER_ADDRESS, signatures: GOLDENS.cosign.signatures },
        ])
    })
})
