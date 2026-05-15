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
import { useDeepLink } from '../useDeepLink'
import { useDeeplinkListener } from '../useDeeplinkListener'
import { StackActions } from '@react-navigation/native'
import { parseDeeplink } from '../deeplink/parser'
import { DeeplinkType } from '../deeplink/types'
import { Linking } from 'react-native'
import { useImportAccount } from '@perawallet/wallet-core-accounts'
import { useMarkMnemonicBackupComplete } from '@perawallet/wallet-core-backup'

const { mockNavigate, mockDispatch } = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockDispatch: vi.fn(),
}))

vi.mock('@routes/navigationRef', () => ({
    navigationRef: {
        navigate: mockNavigate,
        dispatch: mockDispatch,
        isReady: vi.fn(() => true),
    },
}))

vi.mock('@react-navigation/native', () => ({
    createNavigationContainerRef: () => ({
        navigate: vi.fn(),
        dispatch: vi.fn(),
        reset: vi.fn(),
        goBack: vi.fn(),
        isReady: vi.fn(() => true),
        current: null,
    }),
    StackActions: {
        replace: vi.fn(),
        push: vi.fn(),
    },
}))

vi.mock('../deeplink/parser', () => ({
    parseDeeplink: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: {
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
    generateOrderedUniqueId: vi.fn(() => 'test-id'),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({ addSignRequest: vi.fn() }),
}))

const mockImportAccount = vi.fn()
const mockMarkBackupComplete = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: () => ({ address: 'addr1' }),
    useSelectedAccountAddress: () => ({ setSelectedAccountAddress: vi.fn() }),
    resolveImportAccountType: (mnemonic: string) => {
        const wordCount = mnemonic.trim().split(/\s+/).length
        if (wordCount === 24) return { success: true, accountType: 'hdWallet' }
        if (wordCount === 25) return { success: true, accountType: 'algo25' }
        return { success: false, wordCount }
    },
    useImportAccount: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    useMarkMnemonicBackupComplete: vi.fn(),
}))

const { mockPushWebView } = vi.hoisted(() => ({
    mockPushWebView: vi.fn(),
}))

vi.mock('@modules/webview/hooks', () => ({
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))

vi.mock('@modules/webview/hooks/useWebViewStore', () => ({
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))

vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    useWalletConnect: () => ({ connect: vi.fn() }),
}))

const { mockInfoToast, mockErrorToast } = vi.hoisted(() => ({
    mockInfoToast: vi.fn(),
    mockErrorToast: vi.fn(),
}))

vi.mock('../useToast', () => ({
    useToast: vi.fn(() => ({
        showToast: vi.fn(),
        errorToast: mockErrorToast,
        infoToast: mockInfoToast,
    })),
}))

vi.mock('react-native', () => ({
    Linking: {
        getInitialURL: vi.fn(),
        addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    },
}))

describe('useDeepLink', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useImportAccount).mockReturnValue(mockImportAccount)
        vi.mocked(useMarkMnemonicBackupComplete).mockReturnValue(
            mockMarkBackupComplete,
        )
    })

    it('should validate deeplink', () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.HOME,
        })
        const { result } = renderHook(() => useDeepLink())

        expect(result.current.isValidDeepLink('perawallet://app')).toBe(true)
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

        expect(vi.mocked(StackActions.replace)).toHaveBeenCalledWith(
            'AddContact',
            {
                address: 'addr1',
                label: 'Label1',
            },
        )
        expect(mockDispatch).toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
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

        expect(mockInfoToast).toHaveBeenCalledWith(
            'Algo Transfer',
            'Algo transfer screen not implemented yet',
        )
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

        expect(mockInfoToast).toHaveBeenCalledWith(
            'Asset Transfer',
            'Asset transfer screen not implemented yet',
        )
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

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Home',
            params: {
                screen: 'AssetDetails',
                params: { assetId: '123' },
            },
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

    it('navigates DISCOVER_PATH deeplink with no path when path is omitted', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.DISCOVER_PATH,
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/discover',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Discover',
            params: { path: undefined },
        })
        expect(mockErrorToast).not.toHaveBeenCalled()
    })

    it.each([
        ['absolute-https', 'https://evil.com/phish'],
        ['protocol-relative', '//evil.com/phish'],
        ['javascript:', 'javascript:alert(1)'],
        ['data:', 'data:text/html,<script>x</script>'],
        ['empty', ''],
    ])(
        'blocks DISCOVER_PATH deeplink with %s path',
        async (_label, unsafePath) => {
            ;(parseDeeplink as Mock).mockReturnValue({
                type: DeeplinkType.DISCOVER_PATH,
                path: unsafePath,
                sourceUrl: 'perawallet://app/discover-path/?path=...',
            })
            const mockOnError = vi.fn()
            const { result } = renderHook(() => useDeepLink())

            await act(async () => {
                await result.current.handleDeepLink(
                    'perawallet://app/discover-path/?path=...',
                    false,
                    'deeplink',
                    mockOnError,
                )
            })

            expect(mockNavigate).not.toHaveBeenCalled()
            expect(mockErrorToast).toHaveBeenCalled()
            expect(mockOnError).toHaveBeenCalled()
        },
    )

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

    it.each([
        ['javascript:', 'javascript:alert(1)'],
        ['data:', 'data:text/html,<script>alert(1)</script>'],
        ['file:', 'file:///etc/passwd'],
        ['http:', 'http://example.com/'],
        ['non-URL', 'not a url'],
    ])(
        'blocks DISCOVER_BROWSER deeplink with %s scheme',
        async (_label, adversarialUrl) => {
            ;(parseDeeplink as Mock).mockReturnValue({
                type: DeeplinkType.DISCOVER_BROWSER,
                url: adversarialUrl,
                sourceUrl: 'perawallet://app/discover-browser/?url=...',
            })
            const mockOnError = vi.fn()
            const { result } = renderHook(() => useDeepLink())

            await act(async () => {
                await result.current.handleDeepLink(
                    'perawallet://app/discover-browser/?url=...',
                    false,
                    'deeplink',
                    mockOnError,
                )
            })

            expect(mockPushWebView).not.toHaveBeenCalled()
            expect(mockErrorToast).toHaveBeenCalled()
            expect(mockOnError).toHaveBeenCalled()
        },
    )

    it('allows DISCOVER_BROWSER deeplink for a well-formed HTTPS URL', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.DISCOVER_BROWSER,
            url: 'https://tinyman.org/',
            sourceUrl: 'perawallet://app/discover-browser/?url=...',
        })
        const mockOnSuccess = vi.fn()
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/discover-browser/?url=...',
                false,
                'deeplink',
                undefined,
                mockOnSuccess,
            )
        })

        expect(mockPushWebView).toHaveBeenCalledWith(
            expect.objectContaining({ url: 'https://tinyman.org/' }),
        )
        expect(mockErrorToast).not.toHaveBeenCalled()
        expect(mockOnSuccess).toHaveBeenCalled()
    })

    it('blocks INTERNAL_BROWSER deeplink with an unsafe URL', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.INTERNAL_BROWSER,
            url: 'javascript:alert(1)',
            sourceUrl: 'perawallet://app/internal-browser/?url=...',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/internal-browser/?url=...',
                false,
                'deeplink',
            )
        })

        expect(mockPushWebView).not.toHaveBeenCalled()
        expect(mockErrorToast).toHaveBeenCalled()
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

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Home',
            params: {
                screen: 'AssetDetails',
                params: { assetId: '123' },
            },
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

    it('should handle RECOVER_ADDRESS deeplink and import as HD wallet from QR', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.RECOVER_ADDRESS,
            mnemonic:
                'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13 word14 word15 word16 word17 word18 word19 word20 word21 word22 word23 word24',
        })
        mockImportAccount.mockResolvedValue({
            type: 'hdWallet',
            walletKeyId: 'test-wallet-key-id',
            derivationType: 9,
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/recover',
                false,
                'qr',
            )
        })

        expect(mockImportAccount).toHaveBeenCalledWith({
            mnemonic:
                'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13 word14 word15 word16 word17 word18 word19 word20 word21 word22 word23 word24',
            type: 'hdWallet',
        })
        expect(mockNavigate).toHaveBeenCalledWith('AddAccount', {
            screen: 'SearchAccounts',
            params: {
                mode: 'import',
                walletKeyId: 'test-wallet-key-id',
                derivationType: 9,
            },
        })
    })

    it('should handle RECOVER_ADDRESS deeplink and import as algo25 from QR', async () => {
        const algo25Account = {
            id: 'algo25-id',
            address: 'TEST_ADDRESS',
            type: 'algo25' as const,
            keyPairId: 'algo25-keypair-id',
        }
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.RECOVER_ADDRESS,
            mnemonic:
                'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13 word14 word15 word16 word17 word18 word19 word20 word21 word22 word23 word24 word25',
        })
        mockImportAccount.mockResolvedValue(algo25Account)
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/recover',
                false,
                'qr',
            )
        })

        expect(mockImportAccount).toHaveBeenCalledWith({
            mnemonic:
                'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13 word14 word15 word16 word17 word18 word19 word20 word21 word22 word23 word24 word25',
            type: 'algo25',
        })
        expect(mockMarkBackupComplete).toHaveBeenCalledWith(algo25Account)
        expect(mockNavigate).toHaveBeenCalledWith('AddAccount', {
            screen: 'SearchAccounts',
            params: {
                account: algo25Account,
            },
        })
    })

    it('should ignore RECOVER_ADDRESS deeplink from non-QR source', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.RECOVER_ADDRESS,
            mnemonic:
                'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13 word14 word15 word16 word17 word18 word19 word20 word21 word22 word23 word24',
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
        mockNavigate.mockImplementationOnce(() => {
            throw new Error('Test error')
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
        mockNavigate.mockImplementationOnce(() => {
            throw new Error('Test error')
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

    describe('PERA_WEB_IMPORT', () => {
        // Import inside the describe so the top-of-file mocks don't have to
        // know about the store. The store is a zustand singleton — calling
        // `.getState().setQr(...)` from the dispatcher mutates this exact
        // module instance.
        const importStore = async () =>
            (
                (await import('@modules/onboarding/hooks/peraWebImportFlowStore')) as typeof import('@modules/onboarding/hooks/peraWebImportFlowStore')
            ).usePeraWebImportFlowStore

        const fixtureQr = {
            type: DeeplinkType.PERA_WEB_IMPORT,
            backupId: 'backup-id-1',
            encryptionKey: Uint8Array.from(
                Array.from({ length: 32 }, (_, i) => i + 1),
            ),
            sourceUrl: '{"backupId":"backup-id-1","encryptionKey":"..."}',
        }

        beforeEach(async () => {
            const store = await importStore()
            store.getState().reset()
        })

        it('stashes the QR payload + navigates when source is "qr"', async () => {
            ;(parseDeeplink as Mock).mockReturnValue(fixtureQr)
            const { result } = renderHook(() => useDeepLink())

            await act(async () => {
                await result.current.handleDeepLink(
                    fixtureQr.sourceUrl,
                    true,
                    'qr',
                )
            })

            const store = await importStore()
            const stored = store.getState().qr
            expect(stored).not.toBeNull()
            expect(stored!.backupId).toBe('backup-id-1')
            expect(Array.from(stored!.encryptionKey)).toEqual(
                Array.from(fixtureQr.encryptionKey),
            )
            expect(vi.mocked(StackActions.replace)).toHaveBeenCalledWith(
                'AddAccount',
                expect.objectContaining({ screen: 'PeraWebImportLoading' }),
            )
        })

        it('ignores Pera Web payloads that arrive via a deeplink (QR-only entry point)', async () => {
            ;(parseDeeplink as Mock).mockReturnValue(fixtureQr)
            const { result } = renderHook(() => useDeepLink())

            await act(async () => {
                await result.current.handleDeepLink(
                    fixtureQr.sourceUrl,
                    true,
                    'deeplink',
                )
            })

            const store = await importStore()
            // No setQr fired — a malicious page can't push an inbound URL
            // that auto-triggers an import.
            expect(store.getState().qr).toBeNull()
            expect(vi.mocked(StackActions.replace)).not.toHaveBeenCalledWith(
                'AddAccount',
                expect.objectContaining({ screen: 'PeraWebImportLoading' }),
            )
        })
    })
})
