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

import { render, screen, fireEvent } from '@test-utils/render'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useBottomSheetStore } from '../../../store/bottomSheetStore'
import { useBottomSheetResult } from '../../../hooks/useBottomSheetResult'
import { BottomSheetHost } from '../BottomSheetHost'
import type { InternalRequest } from '../../../types'

// PWBottomSheet is mocked so we can observe its prop wiring without invoking
// the real gorhom modal. Matches the existing pattern in other sheet tests
// (e.g. SigningCompletedBottomSheet.spec.tsx).
vi.mock('@components/core', () => ({
    PWBottomSheet: ({
        children,
        onDismiss,
        isVisible,
        testID,
    }: {
        children: React.ReactNode
        onDismiss?: () => void
        isVisible: boolean
        testID?: string
    }) => (
        <div data-testid={testID ?? 'pw-bottom-sheet'}>
            <span data-testid='visible'>{String(isVisible)}</span>
            <button
                data-testid='trigger-dismiss'
                onClick={() => onDismiss?.()}
            />
            {children}
        </div>
    ),
}))

const makeRequest = (
    overrides: Partial<InternalRequest> = {},
): InternalRequest => ({
    id: 'x',
    contents: <span data-testid='inner'>hi</span>,
    options: undefined,
    isVisible: true,
    resolver: vi.fn(),
    ...overrides,
})

describe('BottomSheetHost', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
    })

    it('renders the request contents', () => {
        render(<BottomSheetHost request={makeRequest()} />)
        expect(screen.getByTestId('inner')).toBeTruthy()
    })

    it('passes isVisible through to PWBottomSheet', () => {
        const { rerender } = render(
            <BottomSheetHost request={makeRequest({ isVisible: true })} />,
        )
        expect(screen.getByTestId('visible').textContent).toBe('true')
        rerender(
            <BottomSheetHost request={makeRequest({ isVisible: false })} />,
        )
        expect(screen.getByTestId('visible').textContent).toBe('false')
    })

    it('calls store.remove(id) when PWBottomSheet fires onDismiss', () => {
        const removeSpy = vi.spyOn(useBottomSheetStore.getState(), 'remove')
        render(<BottomSheetHost request={makeRequest({ id: 'foo' })} />)
        fireEvent.click(screen.getByTestId('trigger-dismiss'))
        expect(removeSpy).toHaveBeenCalledWith('foo')
    })

    it('exposes the request id via context so useBottomSheetResult works', () => {
        const Inner = () => {
            const { resolve } = useBottomSheetResult<string>()
            return (
                <button
                    data-testid='inner-resolve'
                    onClick={() => resolve('ok')}
                />
            )
        }
        useBottomSheetStore
            .getState()
            .request<string>({ id: 'ctx', contents: <Inner /> })
        const req = useBottomSheetStore
            .getState()
            .requests.find(r => r.id === 'ctx')!
        render(<BottomSheetHost request={req} />)
        fireEvent.click(screen.getByTestId('inner-resolve'))
        expect(
            useBottomSheetStore.getState().requests.find(r => r.id === 'ctx')
                ?.isVisible,
        ).toBe(false)
    })
})
