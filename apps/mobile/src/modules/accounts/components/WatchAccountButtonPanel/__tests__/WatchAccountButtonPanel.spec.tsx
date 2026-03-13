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
import { WatchAccountButtonPanel } from '../WatchAccountButtonPanel'

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

describe('WatchAccountButtonPanel', () => {
    it('renders all buttons correctly', () => {
        render(
            <WatchAccountButtonPanel
                onCopyAddress={vi.fn()}
                onShowQR={vi.fn()}
                onMore={vi.fn()}
            />,
        )
        expect(
            screen.getByText('account_details.watch_button_panel.copy_address'),
        ).toBeTruthy()
        expect(
            screen.getByText('account_details.watch_button_panel.show_qr'),
        ).toBeTruthy()
        expect(
            screen.getByText('account_details.watch_button_panel.more'),
        ).toBeTruthy()
    })

    it('does not render send or swap buttons', () => {
        render(
            <WatchAccountButtonPanel
                onCopyAddress={vi.fn()}
                onShowQR={vi.fn()}
                onMore={vi.fn()}
            />,
        )
        expect(() =>
            screen.getByText('account_details.button_panel.swap'),
        ).toThrow()
        expect(() =>
            screen.getByText('account_details.button_panel.send'),
        ).toThrow()
    })

    it('calls onCopyAddress when copy address button is pressed', () => {
        const onCopyAddress = vi.fn()
        render(
            <WatchAccountButtonPanel
                onCopyAddress={onCopyAddress}
                onShowQR={vi.fn()}
                onMore={vi.fn()}
            />,
        )
        fireEvent.click(
            screen.getByText('account_details.watch_button_panel.copy_address'),
        )
        expect(onCopyAddress).toHaveBeenCalledOnce()
    })

    it('calls onShowQR when show QR button is pressed', () => {
        const onShowQR = vi.fn()
        render(
            <WatchAccountButtonPanel
                onCopyAddress={vi.fn()}
                onShowQR={onShowQR}
                onMore={vi.fn()}
            />,
        )
        fireEvent.click(
            screen.getByText('account_details.watch_button_panel.show_qr'),
        )
        expect(onShowQR).toHaveBeenCalledOnce()
    })

    it('calls onMore when more button is pressed', () => {
        const onMore = vi.fn()
        render(
            <WatchAccountButtonPanel
                onCopyAddress={vi.fn()}
                onShowQR={vi.fn()}
                onMore={onMore}
            />,
        )
        fireEvent.click(
            screen.getByText('account_details.watch_button_panel.more'),
        )
        expect(onMore).toHaveBeenCalledOnce()
    })
})
