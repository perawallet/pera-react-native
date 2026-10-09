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

import { describe, expect, it, vi } from 'vitest'
import { ErrorCategory } from '@perawallet/wallet-core-shared'
import {
    InvalidPrivateKeyError,
    parseEthereumPrivateKey,
    revealEthereumPrivateKey,
} from '../private-key'

const HARDHAT_0 =
    'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const ORDER = 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141'
const ORDER_MINUS_ONE =
    'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140'
const ORDER_PLUS_ONE =
    'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364142'

const toHex = (bytes: Uint8Array) =>
    Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')

describe('parseEthereumPrivateKey', () => {
    it.each([
        ['a 0x prefix', `0x${HARDHAT_0}`],
        ['a 0X prefix', `0X${HARDHAT_0}`],
        ['no prefix', HARDHAT_0],
        ['uppercase digits', HARDHAT_0.toUpperCase()],
        ['surrounding whitespace', `  0x${HARDHAT_0}\n`],
    ])('parses a key with %s to the same 32 bytes', (_label, input) => {
        const bytes = parseEthereumPrivateKey(input)

        expect(bytes).toHaveLength(32)
        expect(toHex(bytes)).toBe(HARDHAT_0)
    })

    it('accepts the largest key below the curve order and the smallest valid one', () => {
        expect(toHex(parseEthereumPrivateKey(ORDER_MINUS_ONE))).toBe(
            ORDER_MINUS_ONE,
        )
        expect(parseEthereumPrivateKey('0'.repeat(63) + '1')[31]).toBe(1)
    })

    it.each([
        ['63 characters', HARDHAT_0.slice(1)],
        ['65 characters', `${HARDHAT_0}0`],
        ['non-hex characters', `${HARDHAT_0.slice(1)}g`],
        ['empty input', ''],
        ['only a prefix', '0x'],
        ['a zero key', '0'.repeat(64)],
        ['the curve order', ORDER],
        ['above the curve order', ORDER_PLUS_ONE],
        ['all ones', 'f'.repeat(64)],
    ])('rejects %s', (_label, input) => {
        expect(() => parseEthereumPrivateKey(input)).toThrow(
            InvalidPrivateKeyError,
        )
    })

    it('never carries the rejected input in the error', () => {
        const input = `${HARDHAT_0}0`

        let thrown: InvalidPrivateKeyError | undefined
        try {
            parseEthereumPrivateKey(input)
        } catch (error) {
            thrown = error as InvalidPrivateKeyError
        }

        expect(thrown?.metadata).toMatchObject({
            messageKey: 'errors.evm.invalid_private_key',
            category: ErrorCategory.VALIDATION,
        })
        expect(thrown?.metadata.params).toBeUndefined()
        expect(JSON.stringify(thrown?.metadata)).not.toContain(HARDHAT_0)
        expect(thrown?.message).not.toContain(HARDHAT_0)
    })
})

describe('revealEthereumPrivateKey', () => {
    it('reads the key back through the keystore under the given domain', async () => {
        const key = Uint8Array.from([1, 2, 3])
        const exportSecp256k1Key = vi.fn().mockResolvedValue(key)

        const revealed = await revealEthereumPrivateKey(
            { exportSecp256k1Key },
            'key-id',
            'backup',
        )

        expect(revealed).toBe(key)
        expect(exportSecp256k1Key).toHaveBeenCalledWith('key-id', 'backup')
    })
})
