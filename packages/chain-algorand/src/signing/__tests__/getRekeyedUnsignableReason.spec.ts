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

import { beforeEach, describe, it, expect } from 'vitest'
import '../../__tests__/registerAlgorandAccounts'
import {
    useAccountChainStateStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { seedAuthority } from '../../accounts/__tests__/seedAuthority'
import type { SignRequest } from '@perawallet/wallet-core-signing'
import {
    getRekeyedUnsignableReason,
    resolveAllSignerAddresses,
    resolveSigningAccounts,
} from '../getRekeyedUnsignableReason'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { generateMultisigAddress } from '../../multisig/address'
import { encodeTransactionRaw } from '../../blockchain/utils/transact'
import { decodeUnsignedAlgorandTransaction } from '../unsignedTransaction'
import { Address } from 'algosdk'
import {
    asUnsignedAlgorandTransaction,
    MAINNET_GENESIS_HASH,
    makeTestAddress,
    makeTestPaymentTx,
    makeUnsignedAlgorandTransaction,
} from './transactions'

const SCOPE = { chainId: ALGORAND_CHAIN_ID, networkId: 'mainnet' } as const
const OK_SENDER = makeTestAddress(10).toString()
const REKEYED_EXTERNAL = makeTestAddress(11).toString()
const REKEYED_TO_WATCH = makeTestAddress(12).toString()
const EXTERNAL_AUTH = makeTestAddress(13).toString()
const WATCH_AUTH = makeTestAddress(14).toString()
const UNKNOWN = makeTestAddress(15).toString()
const UNKNOWN_HELD = makeTestAddress(16).toString()

const accounts = [
    {
        id: 'ok',
        custody: { kind: 'local', seed: null },
        chains: {
            [ALGORAND_CHAIN_ID]: {
                address: OK_SENDER,
                keyPairId: 'kp-ok',
            },
        },
    },
    {
        id: 'ext',
        custody: { kind: 'local', seed: null },
        chains: {
            [ALGORAND_CHAIN_ID]: {
                address: REKEYED_EXTERNAL,
                keyPairId: 'kp-ext',
            },
        },
        rekeyAddress: EXTERNAL_AUTH,
    },
    {
        id: 'rw',
        custody: { kind: 'local', seed: null },
        chains: {
            [ALGORAND_CHAIN_ID]: {
                address: REKEYED_TO_WATCH,
                keyPairId: 'kp-rw',
            },
        },
        rekeyAddress: WATCH_AUTH,
    },
    {
        id: 'watch-auth',
        custody: { kind: 'watch' },
        chains: {
            [ALGORAND_CHAIN_ID]: {
                address: WATCH_AUTH,
            },
        },
    },
] as unknown as WalletAccount[]

beforeEach(() => {
    useAccountChainStateStore.getState().resetState()
    seedAuthority(REKEYED_EXTERNAL, EXTERNAL_AUTH)
    seedAuthority(REKEYED_TO_WATCH, WATCH_AUTH)
})

const paymentFrom = (sender: string) =>
    makeTestPaymentTx(Address.fromString(sender), {
        receiver: makeTestAddress(7),
        genesisHash: MAINNET_GENESIS_HASH,
    })

const txRequest = (senders: string[], overrides: object = {}): SignRequest =>
    ({
        id: 'r1',
        type: 'transactions',
        transport: 'network',
        txs: senders.map(sender =>
            asUnsignedAlgorandTransaction(paymentFrom(sender)),
        ),
        ...overrides,
    }) as SignRequest

// ARC-0001 `signers: [signer]` for `sender`: the payload carries the named
// signer as its authority, as `enqueueArc0001SignRequest` builds it.
const namedSignerRequest = (sender: string, signer: string): SignRequest =>
    ({
        id: 'r1',
        type: 'transactions',
        transport: 'network',
        txs: [
            asUnsignedAlgorandTransaction(paymentFrom(sender), {
                authorizer: signer,
            }),
        ],
        chainData: {
            algorand: { signerOverrides: new Map([[0, signer]]) },
        },
    }) as SignRequest

describe('getRekeyedUnsignableReason', () => {
    it('returns null for a signable sender', () => {
        expect(
            getRekeyedUnsignableReason(txRequest([OK_SENDER]), accounts),
        ).toBeNull()
    })

    it('reports a sender rekeyed to an address not held in the wallet', () => {
        expect(
            getRekeyedUnsignableReason(txRequest([REKEYED_EXTERNAL]), accounts),
        ).toEqual({
            kind: 'authMissing',
            senderAddress: REKEYED_EXTERNAL,
            authAddress: EXTERNAL_AUTH,
        })
    })

    it('reports a sender rekeyed to a watch-only account', () => {
        expect(
            getRekeyedUnsignableReason(txRequest([REKEYED_TO_WATCH]), accounts),
        ).toEqual({
            kind: 'authIsWatch',
            senderAddress: REKEYED_TO_WATCH,
            authAddress: WATCH_AUTH,
        })
    })

    it('inspects every transaction, not only the first', () => {
        expect(
            getRekeyedUnsignableReason(
                txRequest([OK_SENDER, REKEYED_EXTERNAL]),
                accounts,
            ),
        ).toEqual({
            kind: 'authMissing',
            senderAddress: REKEYED_EXTERNAL,
            authAddress: EXTERNAL_AUTH,
        })
    })

    // The wallet stamps a rekeyed sender's payload with its authority, so an
    // override naming the sender there signs for it through that rekey.
    it('checks an override naming the sender as the sender, following its rekey', () => {
        const request = {
            id: 'r1',
            type: 'transactions',
            transport: 'network',
            txs: [
                asUnsignedAlgorandTransaction(paymentFrom(REKEYED_EXTERNAL), {
                    authorizer: EXTERNAL_AUTH,
                }),
            ],
            chainData: {
                algorand: { signerOverrides: new Map([[0, REKEYED_EXTERNAL]]) },
            },
        } as SignRequest
        expect(getRekeyedUnsignableReason(request, accounts)).toEqual({
            kind: 'authMissing',
            senderAddress: REKEYED_EXTERNAL,
            authAddress: EXTERNAL_AUTH,
        })
    })

    // ARC-0001 `authAddr` equal to the sender: its own key signs, so the rekey
    // to an account the wallet doesn't hold is no obstacle.
    it('checks an authAddr naming the sender against its own key, not its rekey', () => {
        expect(
            getRekeyedUnsignableReason(
                namedSignerRequest(REKEYED_EXTERNAL, REKEYED_EXTERNAL),
                accounts,
            ),
        ).toBeNull()
    })

    // A dApp's escrow rekeyed to REKEYED_EXTERNAL: its own key signs, whatever
    // REKEYED_EXTERNAL is itself rekeyed to.
    it("doesn't follow the rekey of an account named to sign another's transaction", () => {
        expect(
            getRekeyedUnsignableReason(
                namedSignerRequest(UNKNOWN, REKEYED_EXTERNAL),
                accounts,
            ),
        ).toBeNull()
    })

    it("reports an account named to sign another's transaction whose own key the wallet doesn't hold", () => {
        expect(
            getRekeyedUnsignableReason(
                namedSignerRequest(UNKNOWN, WATCH_AUTH),
                accounts,
            ),
        ).toEqual({
            kind: 'authKeyMissing',
            senderAddress: UNKNOWN,
            authAddress: WATCH_AUTH,
        })
    })

    // The pipeline's own test (`hasSignerCredential`): a key on another chain
    // signs nothing here.
    it('reports a named signer whose only key is on another chain', () => {
        const otherChainKeyed = {
            id: 'other-chain-keyed',
            custody: { kind: 'local', seed: null },
            chains: {
                [ALGORAND_CHAIN_ID]: { address: UNKNOWN_HELD },
                other: { address: 'OTHER', keyPairId: 'kp-other' },
            },
        } as unknown as WalletAccount

        expect(
            getRekeyedUnsignableReason(
                namedSignerRequest(UNKNOWN, UNKNOWN_HELD),
                [...accounts, otherChainKeyed],
            ),
        ).toEqual({
            kind: 'authKeyMissing',
            senderAddress: UNKNOWN,
            authAddress: UNKNOWN_HELD,
        })
    })

    // A participant signs for the joint account, not as its authority, so the
    // planner follows its rekey and the review must check it the same way.
    it("checks a multisig participant's override through the participant's rekey", () => {
        const participants = [REKEYED_EXTERNAL, OK_SENDER]
        const joint = generateMultisigAddress(1, 1, participants)
        const unsigned = decodeUnsignedAlgorandTransaction(
            encodeTransactionRaw(paymentFrom(joint)),
            SCOPE,
            { version: 1, threshold: 1, addresses: participants },
        )
        const request = {
            id: 'r1',
            type: 'transactions',
            transport: 'network',
            txs: [unsigned],
            chainData: {
                algorand: { signerOverrides: new Map([[0, REKEYED_EXTERNAL]]) },
            },
        } as unknown as SignRequest

        expect(getRekeyedUnsignableReason(request, accounts)).toEqual({
            kind: 'authMissing',
            senderAddress: REKEYED_EXTERNAL,
            authAddress: EXTERNAL_AUTH,
        })
    })

    it('reports nothing for an override the payload does not sign with, which the pipeline refuses', () => {
        const request = txRequest([UNKNOWN], {
            chainData: {
                algorand: { signerOverrides: new Map([[0, WATCH_AUTH]]) },
            },
        })
        expect(getRekeyedUnsignableReason(request, accounts)).toBeNull()
    })

    it('covers arbitrary-data signers', () => {
        const request = {
            id: 'r1',
            type: 'arbitrary-data',
            data: [{ signer: REKEYED_TO_WATCH }],
        } as unknown as SignRequest
        expect(getRekeyedUnsignableReason(request, accounts)).toEqual({
            kind: 'authIsWatch',
            senderAddress: REKEYED_TO_WATCH,
            authAddress: WATCH_AUTH,
        })
    })

    it('covers the ARC-60 signer', () => {
        const request = {
            id: 'r1',
            type: 'auth-data',
            authData: { signer: REKEYED_EXTERNAL },
        } as unknown as SignRequest
        expect(getRekeyedUnsignableReason(request, accounts)).toEqual({
            kind: 'authMissing',
            senderAddress: REKEYED_EXTERNAL,
            authAddress: EXTERNAL_AUTH,
        })
    })

    it('excludes multisig-cosign requests (they pin a signable participant)', () => {
        expect(
            getRekeyedUnsignableReason(
                txRequest([REKEYED_EXTERNAL], {
                    sourceType: 'multisig-cosign',
                }),
                accounts,
            ),
        ).toBeNull()
    })

    it('ignores senders that are not held accounts', () => {
        expect(
            getRekeyedUnsignableReason(txRequest([UNKNOWN]), accounts),
        ).toBeNull()
    })
})

describe('resolveSigningAccounts', () => {
    const addressesOf = (signers: WalletAccount[]) =>
        signers.map(signer => signer.chains[ALGORAND_CHAIN_ID]?.address)

    beforeEach(() => seedAuthority(REKEYED_EXTERNAL, OK_SENDER))

    it("resolves a sender's own signer through its rekey", () => {
        expect(
            addressesOf(
                resolveSigningAccounts(txRequest([REKEYED_EXTERNAL]), accounts),
            ),
        ).toEqual([OK_SENDER])
    })

    it("keeps a named signer itself, not the account it's rekeyed to", () => {
        expect(
            addressesOf(
                resolveSigningAccounts(
                    namedSignerRequest(UNKNOWN, REKEYED_EXTERNAL),
                    accounts,
                ),
            ),
        ).toEqual([REKEYED_EXTERNAL])
    })
})

describe('resolveAllSignerAddresses', () => {
    const SENDER = makeTestAddress(5)
    const AUTH = makeTestAddress(6).toString()
    const neutralRequest = (overrides: object = {}): SignRequest =>
        ({
            id: 'req-neutral',
            type: 'transactions',
            transport: 'network',
            txs: [1n, 2n].map(amount =>
                asUnsignedAlgorandTransaction(
                    makeTestPaymentTx(SENDER, {
                        receiver: makeTestAddress(7),
                        amount,
                        genesisHash: MAINNET_GENESIS_HASH,
                    }),
                ),
            ),
            ...overrides,
        }) as SignRequest

    it("names a chain-neutral request's Algorand senders", () => {
        expect(resolveAllSignerAddresses(neutralRequest())).toEqual([
            SENDER.toString(),
            SENDER.toString(),
        ])
    })

    it('names the signer its Algorand group facts give instead of the sender', () => {
        const request = neutralRequest({
            chainData: {
                algorand: { signerOverrides: new Map([[1, AUTH]]) },
            },
        })

        expect(resolveAllSignerAddresses(request)).toEqual([
            SENDER.toString(),
            AUTH,
        ])
    })

    it("names no signers for a chain-neutral payload it can't read", () => {
        const request = {
            id: 'req-neutral',
            type: 'transactions',
            transport: 'network',
            txs: [makeUnsignedAlgorandTransaction()],
        } as SignRequest

        expect(resolveAllSignerAddresses(request)).toEqual([])
    })
})
