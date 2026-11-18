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
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useDraggableAccountList } from '../useDraggableAccountList'

const account = (id: string): WalletAccount => ({ id }) as WalletAccount

type AnyProps = { children?: ReactNode; [key: string]: unknown }

// Walks a rendered element tree for the first element whose props match.
const findElement = (
    node: ReactNode,
    matches: (props: AnyProps) => boolean,
): ReactElement<AnyProps> | undefined => {
    if (!isValidElement<AnyProps>(node)) return undefined
    if (matches(node.props)) return node
    const children = ([] as ReactNode[]).concat(node.props.children ?? [])
    for (const child of children) {
        const found = findElement(child, matches)
        if (found) return found
    }
    return undefined
}

describe('useDraggableAccountList', () => {
    it('reports the dragged order by account id', () => {
        const onReorder = vi.fn()
        const { result } = renderHook(() =>
            useDraggableAccountList({
                onReorder,
                getAccountAddress: () => 'ADDRESS',
            }),
        )

        act(() =>
            result.current.handleDragEnd({
                data: [account('second'), account('first')],
            }),
        )

        expect(onReorder).toHaveBeenCalledWith(['second', 'first'])
    })

    it('keys a row by its account id', () => {
        const { result } = renderHook(() =>
            useDraggableAccountList({
                onReorder: vi.fn(),
                getAccountAddress: () => 'ADDRESS',
            }),
        )

        expect(result.current.keyExtractor(account('first'))).toBe('first')
    })

    it('keeps the drag handle enabled while its row is dragged', () => {
        // Flipping `disabled` remounts the touchable that holds the touch, and
        // the stale responder then eats the next tap (Apply) on Android.
        const { result } = renderHook(() =>
            useDraggableAccountList({
                onReorder: vi.fn(),
                getAccountAddress: () => 'ADDRESS',
            }),
        )
        const drag = vi.fn()

        const row = result.current.renderItem({
            item: account('first'),
            drag,
            isActive: true,
            getIndex: () => 0,
        })
        const handle = findElement(row, props => props.onPressIn === drag)

        expect(handle).toBeDefined()
        expect(handle?.props.disabled).toBeFalsy()
    })
})
