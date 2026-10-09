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

import { vi } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { cardContractTests } from '@perawallet/wallet-core-card/testing'

const { getAlgorandClient } = vi.hoisted(() => ({ getAlgorandClient: vi.fn() }))
vi.mock('../../blockchain', async () => ({
    ...(await vi.importActual<object>('../../blockchain')),
    getAlgorandClient,
}))
vi.mock('@perawallet/wallet-core-accounts', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-accounts')),
    isRekeyedAccount: (account: WalletAccount) =>
        account.address === REKEYED_ADDRESS,
    canSignArc60: () => true,
    canSignProgram: () => true,
}))

import { AlgodError } from '../../blockchain'
import { algorandCardAdapter } from '../adapter'

const ADDRESS = 'A4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DVZ36IB4'
const REKEYED_ADDRESS = 'REKEYED'
const signData = { data: 'ZGF0YQ==', authenticatorData: 'YXV0aA==' }

const arrangeClient = (client: object) =>
    getAlgorandClient.mockReturnValue({
        setDefaultValidityWindow: vi.fn(),
        setDefaultSigner: vi.fn(),
        ...client,
    })

cardContractTests(() => algorandCardAdapter, {
    scope: { chainId: 'algorand', networkId: 'testnet' },
    unconfiguredScope: { chainId: 'algorand', networkId: 'betanet' },
    delegationApproval: {
        address: ADDRESS,
        currency: 'usdc',
        txId: 'TX1',
        signData,
        signature: 'c2ln',
        token: 'tok',
    },
    balance: {
        address: ADDRESS,
        assetId: '10458941',
        arrangeNoHolding: () =>
            arrangeClient({
                client: {
                    algod: {
                        accountInformation: () => ({
                            do: async () => ({ assets: [] }),
                        }),
                    },
                },
            }),
    },
    deposit: {
        params: { sender: ADDRESS, cardAddress: ADDRESS, amount: 1n },
        arrangeBuild: () =>
            arrangeClient({
                newGroup: () => ({
                    addAssetTransfer: vi.fn(),
                    build: async () => ({ transactions: [{ txn: {} }] }),
                }),
            }),
    },
    eligibility: {
        account: { address: ADDRESS } as WalletAccount,
        ineligibleAccount: { address: REKEYED_ADDRESS } as WalletAccount,
    },
    insufficientBalanceError: new AlgodError('overspend', {} as never),
    ownLegNetwork: 'algorand',
    foreignLegNetwork: 'linea',
})
