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
import { cardContractTests } from '@perawallet/wallet-core-card/testing'

const { getAlgorandClient } = vi.hoisted(() => ({ getAlgorandClient: vi.fn() }))
vi.mock('@perawallet/wallet-core-blockchain', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-blockchain')),
    getAlgorandClient,
}))

import { algorandCardAdapter } from '../adapter'

const ADDRESS = 'A4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DVZ36IB4'
const signData = { data: 'ZGF0YQ==', authenticatorData: 'YXV0aA==' }

const algod = (overrides: object) =>
    getAlgorandClient.mockReturnValue({
        setDefaultValidityWindow: vi.fn(),
        setDefaultSigner: vi.fn(),
        client: { algod: overrides },
    })

cardContractTests(() => algorandCardAdapter, {
    network: 'testnet',
    unconfiguredNetwork: 'betanet',
    delegationApproval: {
        address: ADDRESS,
        currency: 'usdc',
        txId: 'TX1',
        signData,
        signature: 'c2ln',
        token: 'tok',
    },
    delegatorProgram: {
        currency: 'usdc',
        delegatorAddress: ADDRESS,
        lsigBytes: 'bHNpZw==',
        cardAddress: ADDRESS,
    },
    balance: {
        address: ADDRESS,
        assetId: '31566704',
        arrangeNoHolding: () =>
            algod({
                accountInformation: () => ({
                    do: async () => ({ assets: [] }),
                }),
            }),
    },
    autoDraw: {
        params: { network: 'testnet', sender: ADDRESS, asset: '31566704' },
        arrangeUnknownState: () =>
            algod({
                getApplicationBoxByName: () => ({
                    do: async () => {
                        throw new Error('algod unreachable')
                    },
                }),
            }),
    },
})
