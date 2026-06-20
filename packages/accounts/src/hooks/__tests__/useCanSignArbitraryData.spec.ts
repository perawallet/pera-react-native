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

import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useCanSignArbitraryData } from '../useCanSignArbitraryData'
import type { WalletAccount } from '../../models'

describe('useCanSignArbitraryData', () => {
    it('returns false when no account is provided', () => {
        const { result } = renderHook(() => useCanSignArbitraryData(null))
        expect(result.current).toBe(false)
    })

    it('returns true for a local-key account (algo25 with keyPairId)', () => {
        const account = {
            type: 'algo25',
            address: 'A',
            keyPairId: 'k',
        } as WalletAccount
        const { result } = renderHook(() => useCanSignArbitraryData(account))
        expect(result.current).toBe(true)
    })

    it('returns false for a hardware account (no local key for off-chain data)', () => {
        const account = { type: 'hardware', address: 'A' } as WalletAccount
        const { result } = renderHook(() => useCanSignArbitraryData(account))
        expect(result.current).toBe(false)
    })

    it('returns false for a watch account', () => {
        const account = { type: 'watch', address: 'A' } as WalletAccount
        const { result } = renderHook(() => useCanSignArbitraryData(account))
        expect(result.current).toBe(false)
    })
})
