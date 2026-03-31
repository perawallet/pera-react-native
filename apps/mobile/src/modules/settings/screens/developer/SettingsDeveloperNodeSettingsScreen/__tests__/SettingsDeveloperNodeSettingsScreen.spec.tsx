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

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, fireEvent, screen } from '@test-utils/render'
import { SettingsDeveloperNodeSettingsScreen } from '../SettingsDeveloperNodeSettingsScreen'
import { useSwitchNetwork } from '@perawallet/wallet-core-device'

const mockSwitchNetwork = vi.fn()
const mockShowToast = vi.fn()
const mockInvalidateQueries = vi.fn()
const mockRestart = vi.fn()

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: vi.fn().mockReturnValue({
        network: 'mainnet',
        isMainnet: true,
        isTestnet: false,
        setNetwork: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useSwitchNetwork: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: vi
        .fn()
        .mockReturnValue([{ address: 'ADDR1' }, { address: 'ADDR2' }]),
}))

vi.mock('@perawallet/wallet-core-sync', () => ({
    getSyncService: () => ({
        invalidateQueries: mockInvalidateQueries,
        restart: mockRestart,
    }),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    Networks: { mainnet: 'mainnet', testnet: 'testnet' },
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

describe('SettingsDeveloperNodeSettingsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSwitchNetwork.mockResolvedValue(undefined)
        ;(useSwitchNetwork as Mock).mockReturnValue({
            switchNetwork: mockSwitchNetwork,
            isSwitching: false,
        })
    })

    it('renders mainnet and testnet radio buttons', () => {
        render(<SettingsDeveloperNodeSettingsScreen />)

        expect(
            screen.getByText('settings.developer.node_settings.mainnet_label'),
        ).toBeTruthy()
        expect(
            screen.getByText('settings.developer.node_settings.testnet_label'),
        ).toBeTruthy()
    })

    it('calls switchNetwork with testnet and account addresses when testnet is pressed', async () => {
        render(<SettingsDeveloperNodeSettingsScreen />)

        const testnetButton = screen.getByTestId('node_settings_testnet_radio')
        fireEvent.click(testnetButton)

        await vi.waitFor(() => {
            expect(mockSwitchNetwork).toHaveBeenCalledWith('testnet', [
                'ADDR1',
                'ADDR2',
            ])
        })
    })

    it('calls switchNetwork with mainnet when mainnet is pressed', async () => {
        render(<SettingsDeveloperNodeSettingsScreen />)

        const mainnetButton = screen.getByTestId('node_settings_mainnet_radio')
        fireEvent.click(mainnetButton)

        await vi.waitFor(() => {
            expect(mockSwitchNetwork).toHaveBeenCalledWith('mainnet', [
                'ADDR1',
                'ADDR2',
            ])
        })
    })

    it('invalidates queries and restarts sync service after successful switch', async () => {
        render(<SettingsDeveloperNodeSettingsScreen />)

        const testnetButton = screen.getByTestId('node_settings_testnet_radio')
        fireEvent.click(testnetButton)

        await vi.waitFor(() => {
            expect(mockInvalidateQueries).toHaveBeenCalled()
            expect(mockRestart).toHaveBeenCalled()
        })
    })

    it('shows error toast when switchNetwork fails', async () => {
        mockSwitchNetwork.mockRejectedValue(new Error('Registration failed'))

        render(<SettingsDeveloperNodeSettingsScreen />)

        const testnetButton = screen.getByTestId('node_settings_testnet_radio')
        fireEvent.click(testnetButton)

        await vi.waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith({
                title: 'settings.developer.node_settings.switch_error_title',
                body: 'settings.developer.node_settings.switch_error_body',
                type: 'error',
            })
        })
    })

    it('does not invalidate queries or restart sync when switchNetwork fails', async () => {
        mockSwitchNetwork.mockRejectedValue(new Error('Registration failed'))

        render(<SettingsDeveloperNodeSettingsScreen />)

        const testnetButton = screen.getByTestId('node_settings_testnet_radio')
        fireEvent.click(testnetButton)

        await vi.waitFor(() => {
            expect(mockShowToast).toHaveBeenCalled()
        })

        expect(mockInvalidateQueries).not.toHaveBeenCalled()
        expect(mockRestart).not.toHaveBeenCalled()
    })

    it('disables radio buttons while switching', () => {
        ;(useSwitchNetwork as Mock).mockReturnValue({
            switchNetwork: mockSwitchNetwork,
            isSwitching: true,
        })

        render(<SettingsDeveloperNodeSettingsScreen />)

        const mainnetButton = screen.getByTestId('node_settings_mainnet_radio')
        const testnetButton = screen.getByTestId('node_settings_testnet_radio')

        fireEvent.click(mainnetButton)
        fireEvent.click(testnetButton)

        expect(mockSwitchNetwork).not.toHaveBeenCalled()
    })
})
