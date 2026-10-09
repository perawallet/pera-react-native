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
import type {
    AssetRef,
    BuildContext,
    ChainId,
    TransactionIntent,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { InvalidSendParamsError, UnsupportedTransactionIntentError } from '../errors'
import type { TransferChainAdapter } from '../transfer-adapter'
import { transferContractTests } from './transfer-contract'

// A second chain that exists only to pressure-test the contract: a payload is
// the transfer in hex, every fee is flat, and nothing needs an opt-in.
const FIXTURE_CHAIN_ID = 'fixturehex' as ChainId
const NATIVE: AssetRef = { chainId: FIXTURE_CHAIN_ID, assetId: 'native' }
const TOKEN: AssetRef = { chainId: FIXTURE_CHAIN_ID, assetId: 'token' }

const context: BuildContext = {
    scope: { chainId: FIXTURE_CHAIN_ID, networkId: 'main' },
}

const hex = (text: string) =>
    Array.from(new TextEncoder().encode(text), byte =>
        byte.toString(16).padStart(2, '0'),
    ).join('')

const assertOwnScope = (intent: TransactionIntent, ctx: BuildContext) => {
    if (ctx.scope.chainId !== FIXTURE_CHAIN_ID) {
        throw new Error(`Not a ${FIXTURE_CHAIN_ID} scope`)
    }
    if (intent.assetRef.chainId !== FIXTURE_CHAIN_ID) {
        throw new InvalidSendParamsError()
    }
}

const fixtureTransferAdapter: TransferChainAdapter = {
    chainId: FIXTURE_CHAIN_ID,
    build: async (intent, ctx) => {
        assertOwnScope(intent, ctx)
        if (intent.kind !== 'transfer') {
            throw new UnsupportedTransactionIntentError(
                intent.kind,
                FIXTURE_CHAIN_ID,
            )
        }
        if (!intent.amount.isInteger() || intent.amount.isNegative()) {
            throw new InvalidSendParamsError()
        }
        const isNative = intent.assetRef.assetId === NATIVE.assetId
        const transaction: UnsignedTransaction = {
            scope: ctx.scope,
            payload: hex(`${intent.from}>${intent.to}:${intent.amount}`),
            summary: {
                kind: isNative ? 'transfer' : 'token-transfer',
                title: { key: 'fixture.transfer' },
                direction: 'out',
                counterparty: intent.to,
                amount: { assetRef: intent.assetRef, value: intent.amount },
                icon: 'send',
            },
            chainData: { family: 'evm' },
        }
        return [transaction]
    },
    getFeeEstimate: async (intent, ctx) => {
        assertOwnScope(intent, ctx)
        return { assetRef: NATIVE, amount: new Decimal(21) }
    },
}

transferContractTests(() => fixtureTransferAdapter, {
    context,
    nativeTransfer: {
        kind: 'transfer',
        from: 'alice',
        to: 'bob',
        assetRef: NATIVE,
        amount: new Decimal(5),
    },
    tokenTransfer: {
        kind: 'transfer',
        from: 'alice',
        to: 'bob',
        assetRef: TOKEN,
        amount: new Decimal(7),
    },
    arrange: () => {},
})
