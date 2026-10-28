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

import {
    afterEach,
    describe,
    it,
    expect,
    beforeEach,
    vi,
    type Mock,
} from 'vitest'
import { renderHook, act } from '@testing-library/react'

import {
    unreachableChainsNoteOf,
    useAccountCapabilityScope,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    type AddressCodec,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { AnalyticsMetadataKey, AnalyticsScreenName } from '@analytics'
import { registerAlgorandAddressCodec } from '@test-utils/algorandAccountsAdapter'
import { shareText } from '@utils/shareText'
import { useReceiveFunds } from '@modules/transactions/hooks'
import { useErrorToast } from '@hooks/useErrorToast'
import { useClipboard } from '@hooks/useClipboard'
import { useQRViewScreen } from '../useQRViewScreen'

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAccountCapabilityScope: vi.fn(),
    unreachableChainsNoteOf: vi.fn(() => null),
}))

const { mockTrackScreen } = vi.hoisted(() => ({ mockTrackScreen: vi.fn() }))

vi.mock('@analytics', async importOriginal => ({
    ...(await importOriginal<typeof import('@analytics')>()),
    trackScreen: mockTrackScreen,
}))

vi.mock('@modules/transactions/hooks', () => ({
    useReceiveFunds: vi.fn(),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: vi.fn(),
}))

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: vi.fn(),
}))

const { mockT } = vi.hoisted(() => ({
    mockT: vi.fn((key: string, _options?: Record<string, unknown>) => key),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: mockT }),
}))

// Ethereum has a display name; Algorand is left without one to exercise the fallback.
vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    chainDisplayNameOf: vi.fn((chainId: string) =>
        chainId === 'ethereum' ? 'Ethereum' : undefined,
    ),
}))

const navigation = vi.hoisted(() => ({
    canGoBack: vi.fn(() => false),
    goBack: vi.fn(),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => navigation,
}))

vi.mock('@components/core', () => ({
    bottomSheetNotifier: { current: null },
}))

vi.mock('@utils/shareText', () => ({
    shareText: vi.fn(),
}))

const ALGORAND_SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const ETHEREUM_SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'sepolia' }

const ALGORAND_ADDRESS =
    'CBLWUBRWCWNKZ2Y2Q5HFKN7XISNBVAN47422MZOKH5OGCZ3H5JYLTDPLOA'

const algorandAccount: WalletAccount = {
    id: 'watch-1',
    name: 'Test Account',
    custody: { kind: 'watch' },
    chains: { algorand: { address: ALGORAND_ADDRESS } },
}

const ethereumAccount: WalletAccount = {
    id: 'watch-2',
    name: 'Ethereum Account',
    custody: { kind: 'watch' },
    chains: { ethereum: { address: '0xabc' } },
}

const stubEthereumCodec = {
    chainId: 'ethereum',
    isValid: (address: string) => address.startsWith('0x'),
    normalize: (address: string) => address.toUpperCase(),
    toPaymentUri: (address: string, opts?: { networkId?: string }) =>
        `stub:${address}@${opts?.networkId}`,
} as unknown as AddressCodec

describe('useQRViewScreen', () => {
    const mockShowError = vi.fn()
    const mockCopyToClipboard = vi.fn()

    const mockOnFinished = vi.fn()

    const givenAccount = (
        account: WalletAccount | undefined,
        scope: ChainScope | null,
    ) => {
        ;(useReceiveFunds as Mock).mockReturnValue({
            selectedAccount: account,
            onFinished: mockOnFinished,
        })
        vi.mocked(useAccountCapabilityScope).mockReturnValue(scope)
    }

    beforeEach(() => {
        vi.clearAllMocks()
        registerAlgorandAddressCodec()
        addressCodecs.register(stubEthereumCodec)
        givenAccount(algorandAccount, ALGORAND_SCOPE)
        ;(useErrorToast as Mock).mockReturnValue({
            showError: mockShowError,
        })
        ;(useClipboard as Mock).mockReturnValue({
            copyToClipboard: mockCopyToClipboard,
        })
    })

    afterEach(() => {
        addressCodecs.reset()
    })

    it('goes back to the picker that led here', () => {
        navigation.canGoBack.mockReturnValue(true)

        const { result } = renderHook(() => useQRViewScreen())
        act(() => result.current.handleBack())

        expect(result.current.canGoBack).toBe(true)
        expect(navigation.goBack).toHaveBeenCalledOnce()
        expect(mockOnFinished).not.toHaveBeenCalled()
    })

    it('ends the flow on back when it opened on the QR', () => {
        navigation.canGoBack.mockReturnValue(false)

        const { result } = renderHook(() => useQRViewScreen())
        act(() => result.current.handleBack())

        expect(result.current.canGoBack).toBe(false)
        expect(navigation.goBack).not.toHaveBeenCalled()
        expect(mockOnFinished).toHaveBeenCalledOnce()
    })

    it('resolves the account chain for receiving', () => {
        renderHook(() => useQRViewScreen())

        expect(useAccountCapabilityScope).toHaveBeenCalledWith(
            algorandAccount,
            'receive',
            undefined,
        )
    })

    it('resolves the pinned chain when the flow was opened for one', () => {
        ;(useReceiveFunds as Mock).mockReturnValue({
            selectedAccount: ethereumAccount,
            chainId: 'ethereum',
        })
        vi.mocked(useAccountCapabilityScope).mockReturnValue(ETHEREUM_SCOPE)

        const { result } = renderHook(() => useQRViewScreen())

        expect(useAccountCapabilityScope).toHaveBeenCalledWith(
            ethereumAccount,
            'receive',
            'ethereum',
        )
        expect(result.current.paymentUri).toBe('stub:0XABC@sepolia')
    })

    it('encodes an Algorand account through its chain codec', () => {
        const { result } = renderHook(() => useQRViewScreen())

        expect(result.current.account).toEqual(algorandAccount)
        expect(result.current.accountName).toBe('Test Account')
        expect(result.current.address).toBe(ALGORAND_ADDRESS)
        expect(result.current.paymentUri).toBe(
            'algorand://CBLWUBRWCWNKZ2Y2Q5HFKN7XISNBVAN47422MZOKH5OGCZ3H5JYLTDPLOA',
        )
        expect(result.current.canReceive).toBe(true)
    })

    it('encodes an account on another chain through that chain codec at its network', () => {
        givenAccount(ethereumAccount, ETHEREUM_SCOPE)

        const { result } = renderHook(() => useQRViewScreen())

        expect(result.current.accountName).toBe('Ethereum Account')
        expect(result.current.address).toBe('0XABC')
        expect(result.current.paymentUri).toBe('stub:0XABC@sepolia')
        expect(result.current.canReceive).toBe(true)
    })

    it('names the chain the QR is for', () => {
        givenAccount(ethereumAccount, ETHEREUM_SCOPE)

        const { result } = renderHook(() => useQRViewScreen())

        expect(result.current.chainId).toBe('ethereum')
        expect(result.current.receiveCaption).toBe(
            'receive_funds.qrview.receive_on',
        )
        expect(mockT).toHaveBeenCalledWith('receive_funds.qrview.receive_on', {
            chain: 'Ethereum',
        })
    })

    it('names the chain by its id when it has no display name', () => {
        renderHook(() => useQRViewScreen())

        expect(mockT).toHaveBeenCalledWith('receive_funds.qrview.receive_on', {
            chain: 'algorand',
        })
    })

    it('cannot receive when there is no account', () => {
        givenAccount(undefined, null)

        const { result } = renderHook(() => useQRViewScreen())

        expect(result.current.canReceive).toBe(false)
        expect(result.current.accountName).toBe('')
        expect(result.current.address).toBe('')
        expect(result.current.paymentUri).toBe('')
        expect(result.current.chainId).toBeUndefined()
        expect(result.current.receiveCaption).toBe('')
    })

    it("explains the account's kind can't use a pinned chain out of its reach", () => {
        ;(useReceiveFunds as Mock).mockReturnValue({
            selectedAccount: algorandAccount,
            chainId: 'ethereum',
        })
        vi.mocked(useAccountCapabilityScope).mockReturnValue(null)
        vi.mocked(unreachableChainsNoteOf).mockReturnValueOnce(
            'kind.unreachable_note' as never,
        )

        const { result } = renderHook(() => useQRViewScreen())

        expect(unreachableChainsNoteOf).toHaveBeenCalledWith(algorandAccount, [
            'ethereum',
        ])
        expect(result.current.canReceive).toBe(false)
        expect(result.current.emptyTitle).toBe(
            'receive_funds.qrview.chain_unavailable_title',
        )
        expect(result.current.emptyBody).toBe('kind.unreachable_note')
    })

    it('says no account is selected when there is none', () => {
        givenAccount(undefined, null)

        const { result } = renderHook(() => useQRViewScreen())

        expect(result.current.emptyTitle).toBe(
            'receive_funds.qrview.error_title',
        )
        expect(result.current.emptyBody).toBe('receive_funds.qrview.error_body')
    })

    it('cannot receive when the account has no chain with receive on', () => {
        givenAccount(algorandAccount, null)

        const { result } = renderHook(() => useQRViewScreen())

        expect(result.current.canReceive).toBe(false)
        expect(result.current.address).toBe('')
        expect(result.current.paymentUri).toBe('')
    })

    it('cannot receive when no codec is registered for the account chain', () => {
        addressCodecs.reset()

        const { result } = renderHook(() => useQRViewScreen())

        expect(result.current.canReceive).toBe(false)
        expect(result.current.address).toBe('')
        expect(result.current.paymentUri).toBe('')
    })

    it('cannot receive when the stored address fails its chain codec validation', () => {
        givenAccount(
            {
                ...ethereumAccount,
                chains: { ethereum: { address: 'corrupt' } },
            },
            ETHEREUM_SCOPE,
        )

        const { result } = renderHook(() => useQRViewScreen())

        expect(result.current.canReceive).toBe(false)
        expect(result.current.address).toBe('')
        expect(result.current.paymentUri).toBe('')
    })

    it('copies the normalized address to the clipboard', () => {
        givenAccount(ethereumAccount, ETHEREUM_SCOPE)
        const { result } = renderHook(() => useQRViewScreen())

        act(() => {
            result.current.handleCopyAddress()
        })

        expect(mockCopyToClipboard).toHaveBeenCalledWith('0XABC')
    })

    it('copies nothing when the account cannot receive', () => {
        givenAccount(algorandAccount, null)
        const { result } = renderHook(() => useQRViewScreen())

        act(() => {
            result.current.handleCopyAddress()
        })

        expect(mockCopyToClipboard).not.toHaveBeenCalled()
    })

    it('shares the normalized address under the account name on its chain', async () => {
        vi.mocked(shareText).mockResolvedValue()
        givenAccount(ethereumAccount, ETHEREUM_SCOPE)
        const { result } = renderHook(() => useQRViewScreen())

        await act(async () => {
            await result.current.handleShareAddress()
        })

        expect(shareText).toHaveBeenCalledWith({
            title: 'Ethereum Account',
            message: '0XABC',
        })
    })

    it('does not share when there is no account', async () => {
        givenAccount(undefined, null)
        const { result } = renderHook(() => useQRViewScreen())

        await act(async () => {
            await result.current.handleShareAddress()
        })

        expect(shareText).not.toHaveBeenCalled()
    })

    it('does not share when the account cannot receive', async () => {
        givenAccount(algorandAccount, null)
        const { result } = renderHook(() => useQRViewScreen())

        await act(async () => {
            await result.current.handleShareAddress()
        })

        expect(shareText).not.toHaveBeenCalled()
    })

    it('tracks the QR screen once with the Algorand chain', () => {
        const { rerender } = renderHook(() => useQRViewScreen())
        rerender()

        expect(mockTrackScreen).toHaveBeenCalledOnce()
        expect(mockTrackScreen).toHaveBeenCalledWith(
            AnalyticsScreenName.ShowQr,
            { [AnalyticsMetadataKey.ChainId]: 'algorand' },
        )
    })

    it('tracks the QR screen with the Ethereum chain', () => {
        givenAccount(ethereumAccount, ETHEREUM_SCOPE)

        renderHook(() => useQRViewScreen())

        expect(mockTrackScreen).toHaveBeenCalledWith(
            AnalyticsScreenName.ShowQr,
            { [AnalyticsMetadataKey.ChainId]: 'ethereum' },
        )
    })

    it('does not track the QR screen when there is no account', () => {
        givenAccount(undefined, null)

        renderHook(() => useQRViewScreen())

        expect(mockTrackScreen).not.toHaveBeenCalled()
    })

    it('shows toast on share error', async () => {
        const shareError = new Error('Share failed')
        vi.mocked(shareText).mockRejectedValue(shareError)

        const { result } = renderHook(() => useQRViewScreen())

        await act(async () => {
            await result.current.handleShareAddress()
        })

        expect(mockShowError).toHaveBeenCalledWith(
            shareError,
            'errors.general.title',
            expect.anything(),
        )
    })
})
