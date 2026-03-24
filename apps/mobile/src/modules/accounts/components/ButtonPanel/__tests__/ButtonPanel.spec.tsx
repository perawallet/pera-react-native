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
import { describe, it, expect, vi } from 'vitest'
import { ButtonPanel } from '../ButtonPanel'

const { mockHandleSwap, mockHandleSend, mockHandleReceive, mockHandleMore } =
    vi.hoisted(() => ({
        mockHandleSwap: vi.fn(),
        mockHandleSend: vi.fn(),
        mockHandleReceive: vi.fn(),
        mockHandleMore: vi.fn(),
    }))

vi.mock('../useButtonPanel', () => ({
    useButtonPanel: () => ({
        handleSwap: mockHandleSwap,
        handleSend: mockHandleSend,
        handleReceive: mockHandleReceive,
        handleMore: mockHandleMore,
    }),
}))

vi.mock('@components/core', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWView: ({ children, style }: any) => <div style={style}>{children}</div>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWText: ({ children, style }: any) => <span style={style}>{children}</span>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWTouchableOpacity: ({ children, onPress, style }: any) => (
        <button
            onClick={onPress}
            style={style}
        >
            {children}
        </button>
    ),
    PWRoundIcon: () => null,
}))

vi.mock('@components/RoundButton', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RoundButton: ({ title, onPress }: any) => (
        <button onClick={onPress}>{title}</button>
    ),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

describe('ButtonPanel', () => {
    it('renders all buttons correctly', () => {
        render(<ButtonPanel />)
        expect(
            screen.getByText('account_details.button_panel.swap'),
        ).toBeTruthy()
        expect(
            screen.getByText('account_details.button_panel.send'),
        ).toBeTruthy()
        expect(
            screen.getByText('account_details.button_panel.receive'),
        ).toBeTruthy()
        expect(
            screen.getByText('account_details.button_panel.more'),
        ).toBeTruthy()
    })

    it('does not render stake button', () => {
        render(<ButtonPanel />)
        expect(() =>
            screen.getByText('account_details.button_panel.stake'),
        ).toThrow()
    })

    it('calls handleSwap when swap button is pressed', () => {
        render(<ButtonPanel />)
        fireEvent.click(screen.getByText('account_details.button_panel.swap'))
        expect(mockHandleSwap).toHaveBeenCalledOnce()
    })

    it('calls handleSend when send button is pressed', () => {
        render(<ButtonPanel />)
        fireEvent.click(screen.getByText('account_details.button_panel.send'))
        expect(mockHandleSend).toHaveBeenCalledOnce()
    })

    it('calls handleReceive when receive button is pressed', () => {
        render(<ButtonPanel />)
        fireEvent.click(
            screen.getByText('account_details.button_panel.receive'),
        )
        expect(mockHandleReceive).toHaveBeenCalledOnce()
    })

    it('calls handleMore when more button is pressed', () => {
        render(<ButtonPanel />)
        fireEvent.click(screen.getByText('account_details.button_panel.more'))
        expect(mockHandleMore).toHaveBeenCalledOnce()
    })
})
