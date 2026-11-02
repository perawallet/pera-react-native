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

import { Decimal } from 'decimal.js'
import {
    i18nKey,
    type ChainScope,
    type TransactionNative,
    type TransactionSummary,
    type UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { evmCapabilityDefaults as ethereumCapabilityDefaults } from '@packages/chain-ethereum/src/capability-defaults'
import { evmChainOf } from '@packages/chain-ethereum/src/chains/table'
import { createEthereumReviewer } from '@packages/chain-ethereum/src/signing/review'

export type EthereumDisplayFixtureKind =
    | 'transfer'
    | 'token-transfer'
    | 'nft-transfer'
    | 'contract-call'
    | 'approval'
    | 'contract-creation'

export const ETHEREUM_FIXTURE_SENDER =
    '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
export const ETHEREUM_FIXTURE_RECIPIENT =
    '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
export const ETHEREUM_FIXTURE_TOKEN =
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

// approve(0x0000...8BA3, 2^256 - 1), checked against viem's encodeFunctionData.
// The bytes are hard-coded because viem isn't an apps/mobile dependency.
export const ETHEREUM_FIXTURE_APPROVE_DATA =
    '0x095ea7b3000000000000000000000000000000000022d473030f116ddee9f6b43ac78ba3ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

// No standard token function has this selector, so it reads as an unrecognised call.
export const ETHEREUM_FIXTURE_CONTRACT_CALL_DATA = `0x5ae401dc${'0'.repeat(63)}1${'0'.repeat(64)}`

// transfer(RECIPIENT, 5_000_000)
const TOKEN_TRANSFER_DATA =
    '0xa9059cbb00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c800000000000000000000000000000000000000000000000000000000004c4b40'

export const ETHEREUM_FIXTURE_NFT_CONTRACT =
    '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D'
export const ETHEREUM_FIXTURE_NFT_ID = `${ETHEREUM_FIXTURE_NFT_CONTRACT}/7`

// ERC-721 safeTransferFrom(SENDER, RECIPIENT, 7)
const NFT_TRANSFER_DATA =
    '0x42842e0e000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb9226600000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c80000000000000000000000000000000000000000000000000000000000000007'

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

const BASE_TRANSACTION = {
    type: 'eip1559',
    chainId: 1,
    nonce: 0,
    gas: 21000n,
    maxFeePerGas: 20_000_000_000n,
    maxPriorityFeePerGas: 1_000_000_000n,
}

const CALL_SUMMARY: TransactionSummary = {
    kind: 'contract-call',
    title: { key: i18nKey('transactions.list_item.contract_call') },
    direction: 'none',
    icon: 'contract-call',
}

// The wallet's own claim; the reviewer honours it only because the calldata proves it.
const TOKEN_TRANSFER_SUMMARY: TransactionSummary = {
    kind: 'token-transfer',
    title: { key: i18nKey('transactions.list_item.send') },
    direction: 'out',
    icon: 'send',
    counterparty: ETHEREUM_FIXTURE_RECIPIENT,
    amount: {
        assetRef: { chainId: 'ethereum', assetId: ETHEREUM_FIXTURE_TOKEN },
        value: new Decimal(5_000_000),
    },
}

const NFT_TRANSFER_SUMMARY: TransactionSummary = {
    kind: 'nft-transfer',
    title: { key: i18nKey('transactions.list_item.send') },
    direction: 'out',
    icon: 'send',
    counterparty: ETHEREUM_FIXTURE_RECIPIENT,
    amount: {
        assetRef: { chainId: 'ethereum', assetId: ETHEREUM_FIXTURE_NFT_ID },
        value: new Decimal(1),
    },
}

const TRANSACTIONS: Record<
    EthereumDisplayFixtureKind,
    { transaction: Record<string, unknown>; summary: TransactionSummary }
> = {
    transfer: {
        transaction: {
            ...BASE_TRANSACTION,
            to: ETHEREUM_FIXTURE_RECIPIENT,
            value: 10n ** 18n,
        },
        // A dApp's claim, which the reviewer ignores.
        summary: CALL_SUMMARY,
    },
    'token-transfer': {
        transaction: {
            ...BASE_TRANSACTION,
            to: ETHEREUM_FIXTURE_TOKEN,
            value: 0n,
            gas: 65_000n,
            data: TOKEN_TRANSFER_DATA,
        },
        summary: TOKEN_TRANSFER_SUMMARY,
    },
    'nft-transfer': {
        transaction: {
            ...BASE_TRANSACTION,
            to: ETHEREUM_FIXTURE_NFT_CONTRACT,
            value: 0n,
            gas: 100_000n,
            data: NFT_TRANSFER_DATA,
        },
        summary: NFT_TRANSFER_SUMMARY,
    },
    'contract-call': {
        transaction: {
            ...BASE_TRANSACTION,
            to: ETHEREUM_FIXTURE_TOKEN,
            value: 0n,
            gas: 60_000n,
            data: ETHEREUM_FIXTURE_CONTRACT_CALL_DATA,
        },
        summary: CALL_SUMMARY,
    },
    approval: {
        transaction: {
            ...BASE_TRANSACTION,
            to: ETHEREUM_FIXTURE_TOKEN,
            value: 0n,
            gas: 60_000n,
            data: ETHEREUM_FIXTURE_APPROVE_DATA,
        },
        summary: CALL_SUMMARY,
    },
    'contract-creation': {
        transaction: {
            ...BASE_TRANSACTION,
            value: 0n,
            gas: 100_000n,
            data: '0x6080604052',
        },
        summary: CALL_SUMMARY,
    },
}

export const buildEthereumUnsignedTransaction = (
    kind: EthereumDisplayFixtureKind,
): UnsignedTransaction => ({
    scope: SCOPE,
    payload: {
        from: ETHEREUM_FIXTURE_SENDER,
        transaction: TRANSACTIONS[kind].transaction,
    },
    summary: TRANSACTIONS[kind].summary,
    chainData: { family: 'evm' },
})

/** Runs the fixture through the real Ethereum reviewer, as a signing request would be. */
export const reviewEthereumFixture = async (
    kind: EthereumDisplayFixtureKind,
): Promise<TransactionNative> => {
    const { transactions } = await createEthereumReviewer({
        chain: evmChainOf('ethereum'),
    }).decoder.decode([buildEthereumUnsignedTransaction(kind)], {
        scope: SCOPE,
        heldAddresses: [ETHEREUM_FIXTURE_SENDER],
        isWalletBuilt: kind === 'token-transfer' || kind === 'nft-transfer',
        capabilities: ethereumCapabilityDefaults,
    })
    return transactions[0].native
}
