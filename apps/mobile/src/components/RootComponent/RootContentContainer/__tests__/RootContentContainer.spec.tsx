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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@test-utils/render'
import { RootContentContainer } from '../RootContentContainer'

const mockDeployment = vi.fn()

vi.mock('@routes/index', () => ({ MainRoutes: () => null }))
vi.mock('@modules/webview/shell', () => ({ WebViewOverlay: () => null }))
vi.mock('@modules/walletconnect/shell', () => ({
    PairingProgressOverlay: () => null,
}))
vi.mock('@modules/prompts', () => ({ PromptContainer: () => null }))
vi.mock('@modules/network', () => ({ useNetworkStatusListener: vi.fn() }))
vi.mock('@modules/token', () => ({ useTokenListener: vi.fn() }))
vi.mock('@modules/deeplink/shell', () => ({
    useNotificationDeeplinkListener: vi.fn(),
    useAppQuickActions: vi.fn(),
    usePendingScanRequest: vi.fn(),
}))
vi.mock('@modules/site-safety/shell', () => ({
    usePhishingListRefresh: vi.fn(),
}))
vi.mock('@hooks/useNotificationReceivedListener', () => ({
    useNotificationReceivedListener: vi.fn(),
}))
vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: vi.fn() }),
}))
vi.mock('@hooks/useNetworkLabel', () => ({
    useNetworkLabel: () => (networkId: string) => `network:${networkId}`,
}))
vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useSelectedScope: () => ({ networkId: 'testnet' }),
    useWalletDeployment: () => mockDeployment(),
}))

describe('RootContentContainer', () => {
    beforeEach(() => {
        mockDeployment.mockReset()
    })

    it('shows the network bar when the deployment is not live', () => {
        mockDeployment.mockReturnValue('test')

        render(<RootContentContainer fcmToken={null} />)

        expect(screen.getByText('network:testnet')).toBeTruthy()
    })

    it('shows no network bar on the live deployment', () => {
        mockDeployment.mockReturnValue('live')

        render(<RootContentContainer fcmToken={null} />)

        expect(screen.queryByText('network:testnet')).toBeNull()
    })
})
