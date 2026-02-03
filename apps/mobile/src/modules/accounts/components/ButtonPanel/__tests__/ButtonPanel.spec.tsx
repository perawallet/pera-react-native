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

vi.mock('@react-navigation/native', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...actual,
        useNavigation: () => ({
            replace: vi.fn(),
            push: vi.fn(),
        }),
    }
})

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        render(
            <ButtonPanel
                onSwap={vi.fn()}
                onSend={vi.fn()}
                onReceive={vi.fn()}
                onMore={vi.fn()}
            />,
        )
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
        render(
            <ButtonPanel
                onSwap={vi.fn()}
                onSend={vi.fn()}
                onReceive={vi.fn()}
                onMore={vi.fn()}
            />,
        )
        expect(() =>
            screen.getByText('account_details.button_panel.stake'),
        ).toThrow()
    })

    it('calls onSwap when swap button is pressed', () => {
        const onSwap = vi.fn()
        render(
            <ButtonPanel
                onSwap={onSwap}
                onSend={vi.fn()}
                onReceive={vi.fn()}
                onMore={vi.fn()}
            />,
        )
        fireEvent.click(screen.getByText('account_details.button_panel.swap'))
        expect(onSwap).toHaveBeenCalledOnce()
    })

    it('calls onSend when send button is pressed', () => {
        const onSend = vi.fn()
        render(
            <ButtonPanel
                onSwap={vi.fn()}
                onSend={onSend}
                onReceive={vi.fn()}
                onMore={vi.fn()}
            />,
        )
        fireEvent.click(screen.getByText('account_details.button_panel.send'))
        expect(onSend).toHaveBeenCalledOnce()
    })

    it('calls onReceive when receive button is pressed', () => {
        const onReceive = vi.fn()
        render(
            <ButtonPanel
                onSwap={vi.fn()}
                onSend={vi.fn()}
                onReceive={onReceive}
                onMore={vi.fn()}
            />,
        )
        fireEvent.click(
            screen.getByText('account_details.button_panel.receive'),
        )
        expect(onReceive).toHaveBeenCalledOnce()
    })

    it('calls onMore when more button is pressed', () => {
        const onMore = vi.fn()
        render(
            <ButtonPanel
                onSwap={vi.fn()}
                onSend={vi.fn()}
                onReceive={vi.fn()}
                onMore={onMore}
            />,
        )
        fireEvent.click(screen.getByText('account_details.button_panel.more'))
        expect(onMore).toHaveBeenCalledOnce()
    })
})
