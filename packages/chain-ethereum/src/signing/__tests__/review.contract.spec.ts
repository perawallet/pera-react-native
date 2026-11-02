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

import { encodeFunctionData, erc20Abi, maxUint256 } from 'viem'
import type { TransactionSerializableEIP1559 } from 'viem'
import { transactionReviewerContractTests } from '@perawallet/wallet-core-chain-contract/testing'
import {
    CHAIN_CAPABILITIES,
    type ChainCapabilities,
    type UnsignedTransaction,
    i18nKey,
} from '@perawallet/wallet-core-chain-contract'
import { createEthereumReviewer } from '../review'
import {
    eip155IdOf,
    EVM_TEST_CHAINS,
    evmScopeOf,
} from '../../__tests__/evm-chains'
import type { EvmChain } from '../../chains/types'
import { SENDER, TRANSFER } from './fixtures'

const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const STRANGER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const SECOND_RECIPIENT = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'

const NO_CAPABILITIES = Object.fromEntries(
    CHAIN_CAPABILITIES.map(capability => [capability, false]),
) as ChainCapabilities

const APPROVE: TransactionSerializableEIP1559 = {
    ...TRANSFER,
    to: TOKEN,
    value: 0n,
    data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: ['0x000000000022D473030F116dDEE9F6B43aC78BA3', maxUint256],
    }),
    gas: 60_000n,
}

// No standard token function has this selector.
const OPAQUE_CALL: TransactionSerializableEIP1559 = {
    ...APPROVE,
    data: '0x5ae401dc',
}

const unsignedOn =
    (chain: EvmChain) =>
    (
        transaction: TransactionSerializableEIP1559,
        from: string = SENDER,
    ): UnsignedTransaction => ({
        scope: evmScopeOf(chain),
        payload: {
            from,
            transaction: {
                ...transaction,
                chainId:
                    transaction.chainId === TRANSFER.chainId
                        ? eip155IdOf(chain)
                        : transaction.chainId,
            },
        },
        summary: {
            kind: 'contract-call',
            title: { key: i18nKey('test') },
            direction: 'none',
            icon: 'contract-call',
        },
        chainData: { family: 'evm' },
    })

for (const chain of EVM_TEST_CHAINS) {
    const unsigned = unsignedOn(chain)
    transactionReviewerContractTests(() => createEthereumReviewer({ chain }), {
        context: {
            scope: evmScopeOf(chain),
            heldAddresses: [SENDER],
            isWalletBuilt: false,
            capabilities: NO_CAPABILITIES,
        },
        signer: SENDER,
        plainGroup: [
            unsigned(TRANSFER),
            unsigned({ ...TRANSFER, nonce: 1, to: SECOND_RECIPIENT }),
        ],
        riskyGroup: [unsigned(APPROVE)],
        foreignGroup: [unsigned(APPROVE, STRANGER)],
        opaqueGroup: [unsigned(OPAQUE_CALL)],
        opaqueAutoApproves: false,
        wrongNetworkGroup: [
            unsigned({ ...TRANSFER, chainId: eip155IdOf(chain, 'testnet') }),
        ],
    })
}
