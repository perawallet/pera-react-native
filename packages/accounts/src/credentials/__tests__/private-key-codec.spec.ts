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

import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    accountsChainAdapters,
    type AccountsChainAdapter,
} from '../../chain-adapter'
import { PrivateKeyCodecUnsupportedError } from '../../errors'
import {
    formatPrivateKey,
    isValidPrivateKeyInput,
    parsePrivateKey,
} from '../private-key-codec'

const CODEC_CHAIN_ID = 'fixture-codec' as ChainId
const BARE_CHAIN_ID = 'fixture-bare' as ChainId
const UNREGISTERED_CHAIN_ID = 'fixture-missing' as ChainId

const parse = vi.fn<(input: string) => Uint8Array>()
const format = vi.fn<(privateKey: Uint8Array) => string>()

describe('private-key codec', () => {
    beforeEach(() => {
        parse.mockReset()
        format.mockReset()
        // Only the codec methods are read; the rest of the adapter is absent.
        accountsChainAdapters.register({
            chainId: CODEC_CHAIN_ID,
            parsePrivateKey: parse,
            formatPrivateKey: format,
        } as Partial<AccountsChainAdapter> as AccountsChainAdapter)
        accountsChainAdapters.register({
            chainId: BARE_CHAIN_ID,
        } as Partial<AccountsChainAdapter> as AccountsChainAdapter)
    })

    test('parsePrivateKey delegates to the chain adapter', () => {
        const bytes = Uint8Array.of(1, 2, 3)
        parse.mockReturnValue(bytes)

        expect(parsePrivateKey(CODEC_CHAIN_ID, 'key')).toBe(bytes)
        expect(parse).toHaveBeenCalledWith('key')
    })

    test('formatPrivateKey delegates to the chain adapter', () => {
        format.mockReturnValue('formatted')
        const bytes = Uint8Array.of(1, 2, 3)

        expect(formatPrivateKey(CODEC_CHAIN_ID, bytes)).toBe('formatted')
        expect(format).toHaveBeenCalledWith(bytes)
    })

    test.each([
        ['has no codec', BARE_CHAIN_ID],
        ['has no adapter', UNREGISTERED_CHAIN_ID],
    ])('throws when the chain %s', (_label, chainId) => {
        expect(() => parsePrivateKey(chainId, 'key')).toThrow(
            PrivateKeyCodecUnsupportedError,
        )
        expect(() => formatPrivateKey(chainId, Uint8Array.of(1))).toThrow(
            PrivateKeyCodecUnsupportedError,
        )
    })

    test('isValidPrivateKeyInput is true for parsable input and zeroes the parsed bytes', () => {
        const bytes = Uint8Array.of(9, 9, 9)
        parse.mockReturnValue(bytes)

        expect(isValidPrivateKeyInput(CODEC_CHAIN_ID, 'key')).toBe(true)
        expect(Array.from(bytes)).toEqual([0, 0, 0])
    })

    test('isValidPrivateKeyInput is false when parsing throws', () => {
        parse.mockImplementation(() => {
            throw new Error('invalid')
        })

        expect(isValidPrivateKeyInput(CODEC_CHAIN_ID, 'key')).toBe(false)
    })

    test('isValidPrivateKeyInput is false on a chain with no codec', () => {
        expect(isValidPrivateKeyInput(BARE_CHAIN_ID, 'key')).toBe(false)
    })
})
