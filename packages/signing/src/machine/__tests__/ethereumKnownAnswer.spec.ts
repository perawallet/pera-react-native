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
    type ChainScope,
    type UnsignedTransaction,
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
    type EthereumTransactionPayload,
} from '@perawallet/wallet-core-chain-ethereum/testing'
import { registerAlgorandRulesAs } from '../../__tests__/registerAlgorandAccounts'
import { fakeReviewerAdapter } from '../../__tests__/fakeReviewerAdapter'
import { reviewerChainAdapters } from '../../chain-adapter'
import type { TransactionSignRequest } from '../../models'
import type { TransportResult } from '../../pipeline/types'
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
        title: { key: 'test' },
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
    })

    it("produces exactly the raw transaction viem's signTransaction does", async () => {
        reviewerChainAdapters.register(
            fakeReviewerAdapter({ chainId: 'ethereum' }),
        )
        const { kms, calls } = createVectorKeyStore()
        const request: TransactionSignRequest = {
            id: 'eth-transfer',
            type: 'transactions',
            transport: 'algod',
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
})
