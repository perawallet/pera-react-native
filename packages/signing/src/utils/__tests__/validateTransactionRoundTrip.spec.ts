/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'

import { validateTransactionRoundTrip } from '../validateTransactionRoundTrip'
import { TransactionRoundTripError } from '../../pipeline/errors'

const encodeTransactionRawMock = vi.fn<(tx: PeraTransaction) => Uint8Array>()

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...original,
        encodeTransactionRaw: (tx: PeraTransaction) =>
            encodeTransactionRawMock(tx),
    }
})

// base64 "AQI=" decodes to [0x01, 0x02]; "AQ==" decodes to [0x01].
const fullTx = { tag: 'full' } as unknown as PeraTransaction
const fullBytes = new Uint8Array([0x01, 0x02])
const fullBase64 = 'AQI='

const strippedTx = { tag: 'stripped' } as unknown as PeraTransaction
const strippedBytes = new Uint8Array([0x01])
const strippedBase64 = 'AQ=='

// "VFgBAg==" decodes to [0x54, 0x58, 0x01, 0x02] — TX prefix + fullBytes.
// decodeTransaction accepts either form, so the validator must too.
const fullBase64WithPrefix = 'VFgBAg=='

describe('validateTransactionRoundTrip', () => {
    beforeEach(() => {
        encodeTransactionRawMock.mockReset()
    })

    test('passes when every decoded tx re-encodes to its original raw bytes', () => {
        encodeTransactionRawMock.mockImplementation(tx =>
            tx === fullTx ? fullBytes : strippedBytes,
        )

        expect(() =>
            validateTransactionRoundTrip(
                [fullTx, strippedTx],
                [fullBase64, strippedBase64],
            ),
        ).not.toThrow()
    })

    test('passes when raw bytes include the TX domain-separator prefix', () => {
        encodeTransactionRawMock.mockReturnValueOnce(fullBytes)

        expect(() =>
            validateTransactionRoundTrip([fullTx], [fullBase64WithPrefix]),
        ).not.toThrow()
    })

    test('throws when the decoder silently drops a field (mismatched bytes)', () => {
        // Simulate a decoder that dropped rekeyTo: re-encoding the decoded
        // object produces fewer bytes than the original raw bytes.
        encodeTransactionRawMock.mockReturnValueOnce(strippedBytes)

        expect(() =>
            validateTransactionRoundTrip([strippedTx], [fullBase64]),
        ).toThrow(TransactionRoundTripError)
    })

    test('mismatch message identifies the failing index', () => {
        encodeTransactionRawMock.mockImplementation(tx =>
            tx === fullTx ? fullBytes : strippedBytes,
        )

        expect(() =>
            validateTransactionRoundTrip(
                [fullTx, strippedTx],
                [fullBase64, fullBase64], // index 1 will fail
            ),
        ).toThrow(/index 1/)
    })

    test('throws when decoded and raw arrays have different lengths', () => {
        expect(() =>
            validateTransactionRoundTrip([fullTx, strippedTx], [fullBase64]),
        ).toThrow(/count mismatch/)
    })
})
