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

import { describe, test, expect } from 'vitest'
import { Networks } from '@perawallet/wallet-core-config'
import { decodeFromBase64 } from '@perawallet/wallet-core-shared'
import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'

import { assertTransactionsMatchNetwork } from '../assertTransactionsMatchNetwork'
import { GenesisHashMismatchError } from '../../pipeline/errors'
import {
    makeTestAddress,
    makeTestPaymentTx,
} from '../../test-utils/transactions'

const MAINNET_HASH = 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8='
const TESTNET_HASH = 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI='

const txWithGenesis = (base64Hash: string): PeraTransaction =>
    ({
        genesisHash: decodeFromBase64(base64Hash),
    }) as unknown as PeraTransaction

describe('assertTransactionsMatchNetwork', () => {
    test('passes when every transaction matches the active network', () => {
        expect(() =>
            assertTransactionsMatchNetwork(
                [txWithGenesis(MAINNET_HASH), txWithGenesis(MAINNET_HASH)],
                'mainnet',
                MAINNET_HASH,
            ),
        ).not.toThrow()
    })

    test('throws when mainnet-genesis bytes are signed under testnet', () => {
        expect(() =>
            assertTransactionsMatchNetwork(
                [txWithGenesis(MAINNET_HASH)],
                'testnet',
                TESTNET_HASH,
            ),
        ).toThrow(GenesisHashMismatchError)
    })

    test('throws when one leg of a group carries a foreign genesis hash', () => {
        expect(() =>
            assertTransactionsMatchNetwork(
                [txWithGenesis(MAINNET_HASH), txWithGenesis(TESTNET_HASH)],
                'mainnet',
                MAINNET_HASH,
            ),
        ).toThrow(GenesisHashMismatchError)
    })

    test('throws when a transaction has an undefined genesisHash', () => {
        // Arrange
        const txWithoutGenesis = {} as unknown as PeraTransaction

        // Act & Assert
        expect(() =>
            assertTransactionsMatchNetwork(
                [txWithoutGenesis],
                'mainnet',
                MAINNET_HASH,
            ),
        ).toThrow(GenesisHashMismatchError)
    })

    test('compares against the hash it is given, not the baked config', () => {
        const runtimeHash = 'kUt08LxeVAAGHnh4JoAoAMM9ql/hBwSoiFtlnKNeOxA='
        const transactions = [
            makeTestPaymentTx(makeTestAddress(1), {
                receiver: makeTestAddress(2),
                genesisHash: decodeFromBase64(runtimeHash),
            }),
        ]

        expect(() =>
            assertTransactionsMatchNetwork(
                transactions,
                Networks.fnet,
                runtimeHash,
            ),
        ).not.toThrow()

        expect(() =>
            assertTransactionsMatchNetwork(
                transactions,
                Networks.fnet,
                'mFgazF+2uRS1tMiL9dsj01hJGySEmPN28B/TjjvpVW0=',
            ),
        ).toThrow(GenesisHashMismatchError)
    })

    test('rejects an empty expectedGenesisHash outright, even when a transaction genesisHash is also empty', () => {
        // Without the guard, a transaction with no genesisHash of its own
        // computes actual === '', which would trivially satisfy '' === ''
        // and let an unverified-chain transaction through.
        const txWithoutGenesis = {} as unknown as PeraTransaction

        expect(() =>
            assertTransactionsMatchNetwork([txWithoutGenesis], 'mainnet', ''),
        ).toThrow(GenesisHashMismatchError)
    })
})
