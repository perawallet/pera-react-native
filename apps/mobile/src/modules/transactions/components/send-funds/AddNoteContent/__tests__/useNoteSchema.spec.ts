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
import { renderHook } from '@testing-library/react'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import {
    ETHEREUM_CHAIN_ID,
    registerEthereumChain,
} from '@test-utils/chain-fixtures'
import { useNoteSchema } from '../useNoteSchema'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, options?: { maxBytes?: number }) =>
            `${key}:${options?.maxBytes}`,
    }),
}))

describe('useNoteSchema', () => {
    it('accepts a note of exactly the descriptor limit, counted in UTF-8 bytes', () => {
        const { result } = renderHook(() => useNoteSchema(LEGACY_CHAIN_ID))

        // 512 two-byte characters fill the 1024-byte limit exactly.
        expect(
            result.current.safeParse({ note: 'é'.repeat(512) }).success,
        ).toBe(true)
    })

    it('rejects a note one byte over the limit with the chain limit in the message', () => {
        const { result } = renderHook(() => useNoteSchema(LEGACY_CHAIN_ID))

        const parsed = result.current.safeParse({ note: 'a'.repeat(1025) })

        expect(parsed.success).toBe(false)
        expect(parsed.error?.issues[0]?.message).toBe(
            'send_funds.add_note.too_long:1024',
        )
    })

    it('treats the note as optional', () => {
        const { result } = renderHook(() => useNoteSchema(LEGACY_CHAIN_ID))

        expect(result.current.safeParse({}).success).toBe(true)
    })

    it('accepts any note on a chain that declares no limit', () => {
        registerEthereumChain()
        const { result } = renderHook(() => useNoteSchema(ETHEREUM_CHAIN_ID))

        expect(
            result.current.safeParse({ note: 'a'.repeat(5000) }).success,
        ).toBe(true)
    })
})
