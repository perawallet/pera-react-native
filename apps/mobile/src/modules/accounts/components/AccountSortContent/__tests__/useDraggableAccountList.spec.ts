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

import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useDraggableAccountList } from '../useDraggableAccountList'

const account = (id: string): WalletAccount => ({ id }) as WalletAccount

describe('useDraggableAccountList', () => {
    it('reports the dragged order by account id', () => {
        const onReorder = vi.fn()
        const {result} = renderHook(() => useDraggableAccountList({onReorder}))

        act(() =>
            result.current.handleDragEnd({
                data: [account('second'), account('first')],
            }),
        )

        expect(onReorder).toHaveBeenCalledWith(['second', 'first'])
    })

    it('keys a row by its account id', () => {
        const {result} = renderHook(() =>
            useDraggableAccountList({onReorder: vi.fn()}),
        )

        expect(result.current.keyExtractor(account('first'))).toBe('first')
    })
})
