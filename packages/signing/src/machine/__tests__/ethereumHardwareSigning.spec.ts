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

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createActor, fromPromise, waitFor } from 'xstate'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    i18nKey,
    transactionPlanners,
    transactionReviewers,
    type ChainScope,
    type UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import type { HardwareWalletRegistry } from '@perawallet/wallet-core-hardware-wallet'
import { bytesToHex } from '@perawallet/wallet-core-shared'
import {
    ERC20_TRANSFER,
    SENDER,
    TRANSFER,
    VIEM_ERC20_TRANSFER,
    VIEM_TRANSFER_NONCE_0,
    createVectorLedgerTransport,
    ethereumAddressCodec,
    ethereumDescriptor,
    ethereumLocalKeyKinds,
    ethereumPlannerAdapter,
    ethereumReviewerAdapter,
    recoverTransactionAddress,
    type EthereumTransactionPayload,
} from '@perawallet/wallet-core-chain-ethereum/testing'
import { registerAlgorandRulesAs } from '../../__tests__/registerAlgorandAccounts'
import type { TransactionSignRequest } from '../../models'
import type { TransportResult } from '../../pipeline/types'
import type { SigningMachineInput } from '../context'
import { signingMachine } from '../signingMachine'

const MAINNET: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

// Stored lowercase while the device answers checksummed, so the session's
// address check has to go through the chain's codec.
const hardwareAccount = {
    id: 'eth-ledger',
    custody: {
        kind: 'hardware',
        device: {
            manufacturer: 'ledger',
            deviceId: 'device-1',
            deviceName: 'Nano X',
            transportType: 'ble',
        },
        accountIndex: 0,
    },
    chains: { ethereum: { address: SENDER.toLowerCase() } },
} as unknown as WalletAccount

const unsigned = (
    transaction: EthereumTransactionPayload['transaction'],
): UnsignedTransaction => ({
    scope: MAINNET,
    payload: { from: SENDER, transaction } satisfies EthereumTransactionPayload,
    summary: {
        kind: 'transfer',
        title: { key: i18nKey('test') },
        direction: 'out',
        icon: 'send',
    },
    chainData: { family: 'evm' },
})

// Delivery is stubbed: signing ends at the assembled raw transaction.
const machine = signingMachine.provide({
    actors: {
        transportActor: fromPromise(async (): Promise<TransportResult> => ({
            type: 'submitted',
            txIds: [],
        })),
    },
})

describe('signing an Ethereum transaction on a Ledger through the machine', () => {
    beforeAll(() => {
        registerAlgorandRulesAs('ethereum', {
            descriptor: ethereumDescriptor,
            localKeyKinds: ethereumLocalKeyKinds,
        })
        addressCodecs.register(ethereumAddressCodec)
        transactionPlanners.register(ethereumPlannerAdapter)
        transactionReviewers.register(ethereumReviewerAdapter)
    })

    afterAll(() => {
        addressCodecs.reset()
    })

    it.each([
        ['a native transfer', TRANSFER, VIEM_TRANSFER_NONCE_0],
        ['an ERC-20 transfer', ERC20_TRANSFER, VIEM_ERC20_TRANSFER],
    ])(
        'signs %s on the device into what viem signs, recovering to the account',
        async (_name, transaction, expected) => {
            const { transport, signedPayloads } = createVectorLedgerTransport()
            const connect = vi.fn(async () => transport)
            const registry = {
                getProvider: () => ({ connect }),
            } as unknown as HardwareWalletRegistry
            const keyStore = { sign: vi.fn() }
            const request: TransactionSignRequest = {
                id: 'eth-ledger-transfer',
                type: 'transactions',
                // Reviewed, as every send is: an unknown token can't be
                // auto-approved.
                transport: 'callback',
                sourceType: 'walletconnect',
                txs: [unsigned(transaction)],
            }
            const input = {
                request,
                allAccounts: [hardwareAccount],
                signTransactions: vi.fn(),
                signArbitraryData: vi.fn(),
                signAuthData: vi.fn(),
                createTransport: vi.fn(),
                hardwareWalletRegistry: registry,
                scope: MAINNET,
                keyStore,
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
            const raw = `0x${bytesToHex(signed.bytes)}`
            expect(raw).toBe(expected)
            await expect(
                recoverTransactionAddress({
                    serializedTransaction: raw as `0x02${string}`,
                }),
            ).resolves.toBe(SENDER)
            expect(connect).toHaveBeenCalledWith('device-1', 'ethereum')
            expect(signedPayloads.map(p => p[0])).toEqual([0x02])
            expect(keyStore.sign).not.toHaveBeenCalled()
        },
    )
})
