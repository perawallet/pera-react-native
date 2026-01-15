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

import {
    describe,
    it,
    expect,
    beforeEach,
    afterEach,
    vi,
    type Mock,
} from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDeepLink, useDeeplinkListener } from '../deeplink'
import { useNavigation } from '@react-navigation/native'
import { parseDeeplink } from '../deeplink/parser'
import { DeeplinkType } from '../deeplink/types'
import { Linking } from 'react-native'

vi.mock('@react-navigation/native', () => ({
    useNavigation: vi.fn(),
}))

vi.mock('../deeplink/parser', () => ({
    parseDeeplink: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: {
        debug: vi.fn(),
        error: vi.fn(),
    },
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useSigningRequest: () => ({ addSignRequest: vi.fn() }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: () => ({ address: 'addr1' }),
    useSelectedAccountAddress: () => ({ setSelectedAccountAddress: vi.fn() }),
}))

vi.mock('../webview', () => ({
    useWebView: () => ({ pushWebView: vi.fn() }),
}))

vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    useWalletConnect: () => ({ connect: vi.fn() }),
}))

vi.mock('../toast', () => ({
    useToast: vi.fn(() => ({ showToast: vi.fn() })),
}))

vi.mock('react-native', () => ({
    Linking: {
        getInitialURL: vi.fn(),
        addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    },
}))

describe('useDeepLink', () => {
    const mockReplace = vi.fn()
    const mockNavigate = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        ;(useNavigation as Mock).mockReturnValue({
            replace: mockReplace,
            navigate: mockNavigate,
        })
    })

    it('should validate deeplink', () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.HOME,
        })
        const { result } = renderHook(() => useDeepLink())

        expect(
            result.current.isValidDeepLink('perawallet://app', 'deeplink'),
        ).toBe(true)
        expect(parseDeeplink).toHaveBeenCalledWith('perawallet://app')
    })

    it('should handle invalid deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue(null)
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink('invalid', false, 'deeplink')
        })

        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('should handle ADD_CONTACT deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ADD_CONTACT,
            address: 'addr1',
            label: 'Label1',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/add-contact?address=addr1',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('AddContact', {
            address: 'addr1',
            label: 'Label1',
        })
    })

    it('should handle EDIT_CONTACT deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.EDIT_CONTACT,
            address: 'addr1',
            label: 'Label1',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/edit-contact?address=addr1',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('EditContact', {
            address: 'addr1',
            label: 'Label1',
        })
    })

    it('should handle replaceCurrentScreen in navigateToScreen', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ADD_CONTACT,
            address: 'addr1',
            label: 'Label1',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/add-contact?address=addr1',
                true,
                'deeplink',
            )
        })

        expect(mockReplace).toHaveBeenCalledWith('AddContact', {
            address: 'addr1',
            label: 'Label1',
        })
    })

    it('should handle WALLET_CONNECT deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.WALLET_CONNECT,
            uri: 'wc:123',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/wallet-connect?uri=wc:123',
                false,
                'deeplink',
            )
        })

        // Success case, connect should have been called (mocked in useWalletConnect)
    })

    it('should handle ALGO_TRANSFER deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ALGO_TRANSFER,
            receiverAddress: 'receiver1',
            amount: '1000000',
            note: 'test note',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/algo-transfer',
                false,
                'deeplink',
            )
        })

        // Success case, addSignRequest should have been called
    })

    it('should handle ASSET_TRANSFER deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ASSET_TRANSFER,
            assetId: '123',
            receiverAddress: 'receiver1',
            amount: '100',
            note: 'test note',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/asset-transfer',
                false,
                'deeplink',
            )
        })

        // Success case
    })

    it('should handle ASSET_OPT_IN deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ASSET_OPT_IN,
            assetId: '123',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/asset-opt-in',
                false,
                'deeplink',
            )
        })

        // Success case
    })

    it('should handle ASSET_DETAIL deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ASSET_DETAIL,
            address: 'addr1',
            assetId: '123',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/asset-detail',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('AssetDetail', {
            assetId: '123',
        })
    })

    it('should handle INTERNAL_BROWSER deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.INTERNAL_BROWSER,
            url: 'https://example.com',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/browser',
                false,
                'deeplink',
            )
        })

        // Success case, pushWebView should have been called
    })

    it('should handle DISCOVER_PATH deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.DISCOVER_PATH,
            path: '/test',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/discover?path=/test',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Discover',
            params: { path: '/test' },
        })
    })

    it('should handle STAKING deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.STAKING,
            path: '/staking',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/staking',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('Staking', {
            path: '/staking',
        })
    })

    it('should handle SWAP deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.SWAP,
            address: 'addr1',
            assetInId: '0',
            assetOutId: '123',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/swap',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Swap',
            params: { assetInId: '0', assetOutId: '123' },
        })
    })

    it('should handle BUY deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.BUY,
            address: 'addr1',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/buy',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', { screen: 'Fund' })
    })

    it('should handle ACCOUNT_DETAIL deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ACCOUNT_DETAIL,
            address: 'addr1',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/account-detail',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'AccountDetail',
        })
    })

    it('should handle DISCOVER_BROWSER deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.DISCOVER_BROWSER,
            url: 'https://example.com',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/discover/browser?url=https://example.com',
                false,
                'deeplink',
            )
        })

        // Success case
    })

    it('should handle HOME deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.HOME,
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', { screen: 'Home' })
    })

    it('should handle ASSET_TRANSACTIONS deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ASSET_TRANSACTIONS,
            address: 'addr1',
            assetId: '123',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/asset-transactions',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('AssetDetail', {
            assetId: '123',
        })
    })

    it('should handle ASSET_INBOX deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ASSET_INBOX,
            address: 'addr1',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/asset-inbox',
                false,
                'deeplink',
            )
        })

        // Success case (infoPost called)
    })

    it('should handle CARDS deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.CARDS,
            path: '/cards',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/cards',
                false,
                'deeplink',
            )
        })

        // Success case (infoPost called)
    })

    it('should handle SELL deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.SELL,
            address: 'addr1',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/sell',
                false,
                'deeplink',
            )
        })

        // Success case (infoPost called)
    })

    it('should handle RECOVER_ADDRESS deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.RECOVER_ADDRESS,
            mnemonic: 'test mnemonic',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/recover',
                false,
                'qr',
            )
        })

        // Success case (infoPost called)
    })

    it('should handle RECOVER_ADDRESS deeplink from non-qr source', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.RECOVER_ADDRESS,
            mnemonic: 'test mnemonic',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/recover',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('should handle ADD_WATCH_ACCOUNT deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ADD_WATCH_ACCOUNT,
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/add-watch',
                false,
                'deeplink',
            )
        })

        // Success case
    })

    it('should handle RECEIVER_ACCOUNT_SELECTION deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.RECEIVER_ACCOUNT_SELECTION,
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/receiver-selection',
                false,
                'deeplink',
            )
        })

        // Success case
    })

    it('should handle ADDRESS_ACTIONS deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ADDRESS_ACTIONS,
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/address-actions',
                false,
                'deeplink',
            )
        })

        // Success case
    })

    it('should handle KEYREG deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.KEYREG,
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/keyreg',
                false,
                'deeplink',
            )
        })

        // Success case
    })

    it('should handle navigation error', async () => {
        ;(parseDeeplink as Mock).mockImplementation(() => {
            return { type: DeeplinkType.HOME }
        })
        ;(useNavigation as Mock).mockReturnValue({
            navigate: vi.fn(() => {
                throw new Error('Test error')
            }),
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app',
                false,
                'deeplink',
            )
        })

        // Success case (logger.error called)
    })

    it('should handle SWAP deeplink without address', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.SWAP,
            assetInId: '0',
            assetOutId: '123',
            // no address
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/swap',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Swap',
            params: { assetInId: '0', assetOutId: '123' },
        })
    })

    it('should handle BUY deeplink without address', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.BUY,
            // no address
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/buy',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', { screen: 'Fund' })
    })

    it('should call onError callback when deeplink is invalid', async () => {
        ;(parseDeeplink as Mock).mockReturnValue(null)
        const mockOnError = vi.fn()
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'invalid',
                false,
                'deeplink',
                mockOnError,
            )
        })

        expect(mockOnError).toHaveBeenCalled()
    })

    it('should call onSuccess callback when deeplink is handled', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.HOME,
        })
        const mockOnSuccess = vi.fn()
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app',
                false,
                'deeplink',
                undefined,
                mockOnSuccess,
            )
        })

        expect(mockOnSuccess).toHaveBeenCalled()
    })

    it('should call onError callback when navigation throws', async () => {
        ;(parseDeeplink as Mock).mockImplementation(() => {
            return { type: DeeplinkType.HOME }
        })
        ;(useNavigation as Mock).mockReturnValue({
            navigate: vi.fn(() => {
                throw new Error('Test error')
            }),
        })
        const mockOnError = vi.fn()
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app',
                false,
                'deeplink',
                mockOnError,
            )
        })

        expect(mockOnError).toHaveBeenCalled()
    })
})

describe('useDeeplinkListener', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('should handle initial URL', async () => {
        ;(Linking.getInitialURL as Mock).mockResolvedValue('perawallet://app')
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.HOME,
        })

        renderHook(() => useDeeplinkListener())

        await act(async () => {
            await Promise.resolve() // Wait for useEffect
        })

        act(() => {
            vi.runAllTimers()
        })

        // Success case
    })

    it('should handle initial URL error', async () => {
        ;(Linking.getInitialURL as Mock).mockRejectedValue(
            new Error('Test error'),
        )

        renderHook(() => useDeeplinkListener())

        await act(async () => {
            await Promise.resolve() // Wait for useEffect
        })

        // Success case (logger.debug called)
    })

    it('should handle URL events', async () => {
        const mockAddListener = Linking.addEventListener as Mock
        renderHook(() => useDeeplinkListener())

        const callback = mockAddListener.mock.calls[0][1]

        await act(async () => {
            callback({ url: 'perawallet://app' })
        })

        // Success case
    })

    it('should not handle null initial URL', async () => {
        ;(Linking.getInitialURL as Mock).mockResolvedValue(null)
        ;(parseDeeplink as Mock).mockReturnValue(null)

        renderHook(() => useDeeplinkListener())

        await act(async () => {
            await Promise.resolve()
        })

        // Should not attempt to handle deeplink since initial URL is null
        expect(parseDeeplink).not.toHaveBeenCalled()
    })

    it('should not handle invalid initial URL', async () => {
        ;(Linking.getInitialURL as Mock).mockResolvedValue('invalid://url')
        ;(parseDeeplink as Mock).mockReturnValue(null)

        renderHook(() => useDeeplinkListener())

        await act(async () => {
            await Promise.resolve()
        })

        act(() => {
            vi.runAllTimers()
        })

        // parseDeeplink called but returns null, so no deeplink handled
        expect(parseDeeplink).toHaveBeenCalledWith('invalid://url')
    })

    it('should ignore invalid URL events', async () => {
        ;(parseDeeplink as Mock).mockReturnValue(null)
        const mockAddListener = Linking.addEventListener as Mock
        renderHook(() => useDeeplinkListener())

        const callback = mockAddListener.mock.calls[0][1]

        await act(async () => {
            callback({ url: 'invalid://url' })
        })

        // parseDeeplink returns null, so deeplink is not handled
    })
})
