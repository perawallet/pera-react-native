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

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getAlgorandClient, waitForTransactionConfirmation } = vi.hoisted(
    () => ({
        getAlgorandClient: vi.fn(),
        waitForTransactionConfirmation: vi.fn(),
    }),
)
vi.mock('@perawallet/wallet-core-blockchain', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-blockchain')),
    getAlgorandClient,
    waitForTransactionConfirmation,
}))

import { algorandCardAdapter as adapter } from '../adapter'

const signData = { data: 'ZGF0YQ==', authenticatorData: 'YXV0aA==' }
const accountInformation = vi.fn()
const algod = { accountInformation: () => ({ do: accountInformation }) }

beforeEach(() => {
    vi.clearAllMocks()
    getAlgorandClient.mockReturnValue({
        setDefaultValidityWindow: vi.fn(),
        setDefaultSigner: vi.fn(),
        client: { algod },
    })
})

describe('algorandCardAdapter delegation requests', () => {
    it('builds the Baanx Algorand post-approval body', () => {
        expect(
            adapter.delegationApprovalRequest({
                address: 'FUNDINGADDR',
                currency: 'usdc',
                txId: 'TX123',
                signData,
                signature: 'c2ln',
                token: 'ABC_tok',
            }),
        ).toEqual({
            path: '/v1/delegation/algorand/post-approval',
            data: {
                address: 'FUNDINGADDR',
                network: 'algorand',
                currency: 'usdc',
                amount: '0',
                txHash: 'TX123',
                sigData: signData,
                sigHash: 'c2ln',
                token: 'ABC_tok',
            },
        })
    })

    it('builds the delegator-lsig body with no fields Baanx would reject', () => {
        expect(
            adapter.delegatorProgramRequest({
                currency: 'usdc',
                delegatorAddress: 'FUNDING_ADDR',
                lsigBytes: 'bHNpZw==',
                cardAddress: 'ESCROW_CARD',
            }),
        ).toEqual({
            path: '/v1/delegation/algorand/delegator-lsig',
            data: {
                currency: 'usdc',
                delegatorAddress: 'FUNDING_ADDR',
                lsigBytes: 'bHNpZw==',
                cardAddress: 'ESCROW_CARD',
                blockchain: 'algorand',
            },
        })
    })
})

describe('algorandCardAdapter chain reads', () => {
    it('reads the holding of the asset in base units, zero when not opted in', async () => {
        accountInformation.mockResolvedValueOnce({
            assets: [{ assetId: 10_458_941n, amount: 2_500_000n }],
        })
        accountInformation.mockResolvedValueOnce({ assets: [] })

        await expect(
            adapter.getAssetBalance('testnet', 'ADDR', '10458941'),
        ).resolves.toBe(2_500_000n)
        await expect(
            adapter.getAssetBalance('testnet', 'ADDR', '10458941'),
        ).resolves.toBe(0n)
        expect(getAlgorandClient).toHaveBeenCalledWith('testnet')
    })

    it('waits for the transaction on the network algod', async () => {
        waitForTransactionConfirmation.mockResolvedValue(undefined)

        await adapter.awaitConfirmation('testnet', 'TX1')

        expect(waitForTransactionConfirmation).toHaveBeenCalledWith(
            algod,
            'TX1',
        )
    })
})
