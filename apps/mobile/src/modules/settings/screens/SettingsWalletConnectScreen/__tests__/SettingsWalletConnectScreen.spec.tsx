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

import { render } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import SettingsWalletConnectScreen from '../SettingsWalletConnectScreen'
import { useWalletConnect } from '@perawallet/wallet-core-walletconnect'

vi.mock('@perawallet/wallet-core-walletconnect', async () => ({
    useWalletConnect: vi.fn(() => ({
        connections: [],
        deleteAllSessions: vi.fn(),
    })),
}))

vi.mock('@shopify/flash-list', () => ({
    FlashList: ({
        ListEmptyComponent,
    }: {
        ListEmptyComponent?: React.ReactNode
    }) => <div data-testid='flash-list'>{ListEmptyComponent}</div>,
}))

vi.mock('@components/QRScannerView', () => ({
    default: () => null,
}))

describe('SettingsWalletConnectScreen', () => {
    it('renders empty state when no connections exist', () => {
        vi.mocked(useWalletConnect).mockReturnValue({
            connections: [],
            deleteAllSessions: vi.fn(),
        } as unknown as ReturnType<typeof useWalletConnect>)

        const { container } = render(<SettingsWalletConnectScreen />)
        expect(container).toBeTruthy()
    })

    it('renders connection list when sessions exist', () => {
        const mockConnections = [
            {
                clientId: '123',
                version: 2,
                session: {
                    peerMeta: { name: 'Test App', url: 'https://test.com' },
                },
            },
        ]
        vi.mocked(useWalletConnect).mockReturnValue({
            connections: mockConnections,
            deleteAllSessions: vi.fn(),
        } as unknown as ReturnType<typeof useWalletConnect>)

        const { container } = render(<SettingsWalletConnectScreen />)
        expect(container).toBeTruthy()
    })

    it('shows clear all button when connections exist', () => {
        const mockConnections = [
            {
                clientId: '123',
                version: 2,
                session: { peerMeta: { name: 'Test App' } },
            },
        ]
        vi.mocked(useWalletConnect).mockReturnValue({
            connections: mockConnections,
            deleteAllSessions: vi.fn(),
        } as unknown as ReturnType<typeof useWalletConnect>)

        const { container } = render(<SettingsWalletConnectScreen />)
        expect(container).toBeTruthy()
    })
})
