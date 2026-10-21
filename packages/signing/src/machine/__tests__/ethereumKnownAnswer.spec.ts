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

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { createActor, fromPromise, waitFor } from 'xstate'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    transactionPlanners,
    transactionReviewers,
    type ChainScope,
    type UnsignedTransaction,
    i18nKey,
} from '@perawallet/wallet-core-chain-contract'
import { bytesToHex } from '@perawallet/wallet-core-shared'
import {
    SENDER,
    TRANSFER,
    VIEM_TRANSFER_NONCE_0,
    createVectorKeyStore,
    ethereumDescriptor,
    ethereumLocalKeyKinds,
    ethereumPlannerAdapter,
    ethereumReviewerAdapter,
    type EthereumTransactionPayload,
} from '@perawallet/wallet-core-chain-ethereum/testing'
import { registerAlgorandRulesAs } from '../../__tests__/registerAlgorandAccounts'
import type { TransactionSignRequest } from '../../models'
import type {
    DataTransport,
    SigningResult,
    SourceMetadata,
    TransportResult,
} from '../../pipeline/types'
import type { SigningMachineInput } from '../context'
import { signingMachine } from '../signingMachine'
import { SIGNING_KEY_DOMAIN } from '../../constants'

const MAINNET: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const KEY_PAIR_ID = 'kms-entry-1'

const account = {
    custody: {
        kind: 'local',
        seed: 'bip39',
        hd: { seedId: 'seed-1', account: 0, keyIndex: 0 },
    },
    address: 'ALGORAND_ADDRESS',
    chains: { ethereum: { address: SENDER, keyPairId: KEY_PAIR_ID } },
} as unknown as WalletAccount

const transfer: UnsignedTransaction = {
    scope: MAINNET,
    payload: {
        from: SENDER,
        transaction: TRANSFER,
    } satisfies EthereumTransactionPayload,
    summary: {
        kind: 'transfer',
        title: { key: i18nKey('test') },
        direction: 'out',
        icon: 'send',
    },
    chainData: { family: 'evm' },
}

// Delivery is stubbed: signing ends at the assembled raw transaction.
const machine = signingMachine.provide({
    actors: {
        transportActor: fromPromise(async (): Promise<TransportResult> => ({
            type: 'submitted',
            txIds: [],
        })),
    },
})

describe('signing an Ethereum transaction through the machine', () => {
    beforeAll(() => {
        registerAlgorandRulesAs('ethereum', {
            descriptor: ethereumDescriptor,
            localKeyKinds: ethereumLocalKeyKinds,
        })
        transactionPlanners.register(ethereumPlannerAdapter)
        transactionReviewers.register(ethereumReviewerAdapter)
    })

    it("produces exactly the raw transaction viem's signTransaction does", async () => {
        const { kms, calls } = createVectorKeyStore()
        const request: TransactionSignRequest = {
            id: 'eth-transfer',
            type: 'transactions',
            transport: 'network',
            txs: [transfer],
        }
        const input = {
            request,
            allAccounts: [account],
            signTransactions: vi.fn(),
            signArbitraryData: vi.fn(),
            signAuthData: vi.fn(),
            createTransport: vi.fn(),
            encodeTransaction: vi.fn(),
            scope: MAINNET,
            keyStore: kms,
        } as unknown as SigningMachineInput

        const actor = createActor(machine, { input })
        actor.start()
        await waitFor(actor, s => s.matches('awaiting_user'))
        actor.send({ type: 'USER_APPROVED' })
        const state = await waitFor(actor, s => s.matches('completed'))

        const [analysis] = state.context.analyses ?? []
        expect(analysis?.transactions?.[0]?.summary.kind).toBe('transfer')
        expect(analysis?.signableAddresses).toEqual([SENDER])
        const [result] = state.context.signingResults ?? []
        expect(result.signedData.type).toBe('signed-transactions')
        const [signed] =
            result.signedData.type === 'signed-transactions'
                ? result.signedData.signed
                : []
        expect(`0x${bytesToHex(signed.bytes)}`).toBe(VIEM_TRANSFER_NONCE_0)
        expect(
            calls.map(({ keyPairId, domain }) => ({ keyPairId, domain })),
        ).toEqual([{ keyPairId: KEY_PAIR_ID, domain: SIGNING_KEY_DOMAIN }])
    })

    // Ethereum registers no signing planner adapter, so the transport and the
    // approve callback must work without one.
    it('delivers the signed transaction to a dApp request and answers with the submitted hash', async () => {
        const { kms } = createVectorKeyStore()
        const approve = vi.fn(async () => undefined)
        const send = vi.fn(
            async (
                result: SigningResult,
                source: SourceMetadata,
            ): Promise<TransportResult> => {
                await source.callbacks?.approve?.(result, { txIds: ['0xhash'] })
                return { type: 'submitted-and-answered', txIds: ['0xhash'] }
            },
        )
        const request: TransactionSignRequest = {
            id: 'eth-dapp-send',
            type: 'transactions',
            transport: 'network',
            sourceType: 'walletconnect',
            txs: [transfer],
            approve,
        }
        const input = {
            request,
            allAccounts: [account],
            signTransactions: vi.fn(),
            signArbitraryData: vi.fn(),
            signAuthData: vi.fn(),
            createTransport: vi.fn((): DataTransport => ({ send })),
            encodeTransaction: vi.fn(),
            scope: MAINNET,
            keyStore: kms,
        } as unknown as SigningMachineInput

        const actor = createActor(signingMachine, { input })
        actor.start()
        await waitFor(actor, s => s.matches('awaiting_user'))
        actor.send({ type: 'USER_APPROVED' })
        await waitFor(actor, s => s.matches('completed'))

        expect(approve).toHaveBeenCalledTimes(1)
        const [signed, receipt] = approve.mock.calls[0] as unknown as [
            { bytes: Uint8Array }[],
            { txIds: string[] },
        ]
        expect(`0x${bytesToHex(signed[0].bytes)}`).toBe(VIEM_TRANSFER_NONCE_0)
        expect(receipt).toEqual({ txIds: ['0xhash'] })
    })
})
