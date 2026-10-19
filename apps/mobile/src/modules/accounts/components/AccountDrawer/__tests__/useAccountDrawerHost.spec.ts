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

import type { ReactElement } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

import type { AccountDrawerContentProps } from '../AccountDrawerContent'
import { useAccountDrawerHost } from '../useAccountDrawerHost'

const mocks = vi.hoisted(() => ({
    drawer: {
        isOpen: false,
        progress: { value: 0 },
        openDrawer: vi.fn(),
        closeDrawer: vi.fn(),
        markOpen: vi.fn(),
        markClosed: vi.fn(),
        handleSelected: vi.fn(),
        handleAddAccount: vi.fn(),
        canSearch: true,
        handleSearch: vi.fn(),
        handlePeraCardActivate: vi.fn(),
        handlePeraCardOpen: vi.fn(),
        handleOpenSort: vi.fn(),
    },
    selectOnSelected: vi.fn(),
    filter: vi.fn(() => true),
}))

vi.mock('../useAccountDrawer', () => ({
    useAccountDrawer: () => mocks.drawer,
}))

vi.mock('../useAccountPickers', () => ({
    useAccountPickers: () => ({
        portfolio: { showSearch: true, showPeraCardActivation: true },
        select: {
            hideDefaultHeader: true,
            accountFilter: mocks.filter,
            onSelected: mocks.selectOnSelected,
        },
        swap: {},
        card: {},
        fund: {},
    }),
}))

vi.mock('../AccountDrawerContent', () => ({
    AccountDrawerContent: () => null,
}))

const account = { id: 'acc-1' } as unknown as WalletAccount

const contentProps = (
    renderContent: () => unknown,
): AccountDrawerContentProps =>
    (renderContent() as ReactElement<AccountDrawerContentProps>).props

describe('useAccountDrawerHost', () => {
    beforeEach(() => {
        mocks.drawer.canSearch = true
    })

    it('starts on the portfolio picker with search and the Pera Card row', () => {
        const { result } = renderHook(() => useAccountDrawerHost())

        const props = contentProps(result.current.renderContent)
        expect(result.current.controls.pickerKind).toBe('portfolio')
        expect(props.showSearch).toBe(true)
        expect(props.showPeraCardActivation).toBe(true)
        expect(props.hideDefaultHeader).toBeUndefined()
    })

    it('hides search when the drawer cannot search even if the picker asks for it', () => {
        mocks.drawer.canSearch = false

        const { result } = renderHook(() => useAccountDrawerHost())

        expect(contentProps(result.current.renderContent).showSearch).toBe(
            false,
        )
    })

    it('switches the content to the published picker kind', () => {
        const { result } = renderHook(() => useAccountDrawerHost())

        act(() => result.current.controls.publishPickerKind('select'))

        const props = contentProps(result.current.renderContent)
        expect(result.current.controls.pickerKind).toBe('select')
        expect(props.hideDefaultHeader).toBe(true)
        expect(props.accountFilter).toBe(mocks.filter)
        expect(props.showSearch).toBeFalsy()
    })

    it('closes the drawer and hands the account to the picker on selection', () => {
        const { result } = renderHook(() => useAccountDrawerHost())
        act(() => result.current.controls.publishPickerKind('select'))

        act(() =>
            contentProps(result.current.renderContent).onSelected(account),
        )

        expect(mocks.drawer.handleSelected).toHaveBeenCalledTimes(1)
        expect(mocks.selectOnSelected).toHaveBeenCalledWith(account)
    })

    it('only closes the drawer when the picker has no selection handler', () => {
        const { result } = renderHook(() => useAccountDrawerHost())

        act(() =>
            contentProps(result.current.renderContent).onSelected(account),
        )

        expect(mocks.drawer.handleSelected).toHaveBeenCalledTimes(1)
        expect(mocks.selectOnSelected).not.toHaveBeenCalled()
    })

    it('wires the drawer actions into the content and controls', () => {
        const { result } = renderHook(() => useAccountDrawerHost())

        const props = contentProps(result.current.renderContent)
        expect(props.onAddAccount).toBe(mocks.drawer.handleAddAccount)
        expect(props.onSearch).toBe(mocks.drawer.handleSearch)
        expect(props.onOpenSort).toBe(mocks.drawer.handleOpenSort)
        expect(props.onPeraCardActivate).toBe(
            mocks.drawer.handlePeraCardActivate,
        )
        expect(props.onPeraCardOpen).toBe(mocks.drawer.handlePeraCardOpen)
        expect(result.current.controls.openDrawer).toBe(mocks.drawer.openDrawer)
        expect(result.current.controls.closeDrawer).toBe(
            mocks.drawer.closeDrawer,
        )
        expect(result.current.markOpen).toBe(mocks.drawer.markOpen)
        expect(result.current.markClosed).toBe(mocks.drawer.markClosed)
    })
})
