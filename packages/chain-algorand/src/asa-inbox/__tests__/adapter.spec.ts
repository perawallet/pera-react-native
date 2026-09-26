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
import { ZodError } from 'zod'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { algorandSendFlowAdapter } from '../adapter'

const mocks = vi.hoisted(() => ({
    createWalletAlgorandClient: vi.fn(),
    buildArc59SendViaInboxTxs: vi.fn(),
    buildArc59ClaimTxs: vi.fn(),
    buildArc59RejectTxs: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    createWalletAlgorandClient: mocks.createWalletAlgorandClient,
}))
vi.mock('../builders', () => ({
    buildArc59SendViaInboxTxs: mocks.buildArc59SendViaInboxTxs,
    buildArc59ClaimTxs: mocks.buildArc59ClaimTxs,
    buildArc59RejectTxs: mocks.buildArc59RejectTxs,
}))

const CLIENT = { name: 'wallet-client' }
const TXNS = [{ txn: 'stub' }]

const summary = {
    is_arc59_opted_in: true,
    minimum_balance_requirement: 100000,
    inner_tx_count: 2,
    total_protocol_and_mbr_fee: 4000,
    inbox_address: null,
    algo_fund_amount: 0,
    warning_message: null,
}

const inbox = algorandSendFlowAdapter.assetInbox!

describe('algorandSendFlowAdapter', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.createWalletAlgorandClient.mockReturnValue(CLIENT)
        mocks.buildArc59SendViaInboxTxs.mockResolvedValue(TXNS)
        mocks.buildArc59ClaimTxs.mockResolvedValue(TXNS)
        mocks.buildArc59RejectTxs.mockResolvedValue(TXNS)
    })

    it('serves the Algorand chain', () => {
        expect(algorandSendFlowAdapter.chainId).toBe(ALGORAND_CHAIN_ID)
    })

    it("builds an inbox send with the network's wallet client", async () => {
        const result = await inbox.buildSendTxs({
            network: 'testnet',
            sender: 'SENDER',
            receiver: 'RECEIVER',
            assetId: 7n,
            amount: 10n,
            summary,
            senderMinFee: 1000n,
        })

        expect(result).toBe(TXNS)
        expect(mocks.createWalletAlgorandClient).toHaveBeenCalledWith('testnet')
        expect(mocks.buildArc59SendViaInboxTxs).toHaveBeenCalledWith(
            { algokit: CLIENT, network: 'testnet' },
            {
                sender: 'SENDER',
                receiver: 'RECEIVER',
                assetId: 7n,
                amount: 10n,
                summary,
                senderMinFee: 1000n,
            },
        )
    })

    it('refuses to build from a summary that fails the ARC-59 schema', async () => {
        await expect(
            inbox.buildSendTxs({
                network: 'mainnet',
                sender: 'SENDER',
                receiver: 'RECEIVER',
                assetId: 7n,
                amount: 10n,
                summary: { ...summary, algo_fund_amount: 50_000_000 },
                senderMinFee: 1000n,
            }),
        ).rejects.toBeInstanceOf(ZodError)
        expect(mocks.buildArc59SendViaInboxTxs).not.toHaveBeenCalled()
    })

    it('builds claims and rejects on the requested network', async () => {
        const claim = {
            sender: 'SENDER',
            assetId: 7n,
            shouldClaimAlgo: true,
            inboxAddress: 'INBOX',
            senderMinFee: 1000n,
        }

        await inbox.buildClaimTxs({ network: 'mainnet', ...claim })
        await inbox.buildRejectTxs({
            network: 'mainnet',
            ...claim,
            assetCreator: 'CREATOR',
        })

        expect(mocks.buildArc59ClaimTxs).toHaveBeenCalledWith(
            { algokit: CLIENT, network: 'mainnet' },
            claim,
        )
        expect(mocks.buildArc59RejectTxs).toHaveBeenCalledWith(
            { algokit: CLIENT, network: 'mainnet' },
            { ...claim, assetCreator: 'CREATOR' },
        )
    })
})
