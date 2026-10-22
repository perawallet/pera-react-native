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

const route = vi.hoisted(() => ({ params: undefined as unknown }))

vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({ params: route.params }),
}))
vi.mock('@hooks/useCapableChainIds', () => ({
    useCapableChainId: () => 'algorand',
}))

import { useLedgerFlowChainId } from '../useLedgerFlowChainId'

describe('useLedgerFlowChainId', () => {
    it("runs on the route's chain", () => {
        route.params = { chainId: 'ethereum' }

        const { result } = renderHook(() => useLedgerFlowChainId())

        expect(result.current).toBe('ethereum')
    })

    it('falls back to the first chain with Ledger on when the route names none', () => {
        route.params = undefined

        const { result } = renderHook(() => useLedgerFlowChainId())

        expect(result.current).toBe('algorand')
    })
})
