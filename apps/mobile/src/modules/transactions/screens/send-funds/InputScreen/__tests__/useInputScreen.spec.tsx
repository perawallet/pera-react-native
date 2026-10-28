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
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type Mock,
} from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useInputScreen } from '../useInputScreen'
import { fixtureCodec } from '@packages/chain-contract/src/__tests__/testing'
import { Decimal } from 'decimal.js'

import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import {
    useAssetsQuery,
    useAssetPricesQuery,
} from '@perawallet/wallet-core-assets'
import { addressCodecs, i18nKey } from '@perawallet/wallet-core-chain-contract'
import { useMinFeeForSender } from '@perawallet/wallet-core-signing'
import {
    useSpendableBalanceQuery,
    type ChainNotice,
    type SpendableBalance,
} from '@perawallet/wallet-core-transactions'
import { useToast } from '@hooks/useToast'
import {
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'

const mockNavigate = vi.fn()

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: mockNavigate,
    }),
}))

vi.mock('@components/core', () => ({
    bottomSheetNotifier: { current: null },
    PWButton: vi.fn(),
    PWText: vi.fn(),
    PWView: vi.fn(),
}))

vi.mock('@components/ConfirmActionContent', () => ({
    ConfirmActionContent: () => null,
}))

const { mockRequestBottomSheet } = vi.hoisted(() => ({
    mockRequestBottomSheet: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(),
    // Consumed by the shared useSendDestinationRouter.
    useAccountBalancesQuery: vi.fn(() => ({ accountBalances: new Map() })),
    chainAccountOf: (
        account: { chains: Record<string, unknown> },
        chainId: string,
    ) => account.chains[chainId],
    findAccountByAddressOn: vi.fn(() => undefined),
    useAccountAssetBalanceQuery: vi.fn(() => ({
        data: {
            assetId: '0',
            amount: new Decimal(100),
            nativeValue: new Decimal(100),
        },
    })),
    // Consumed by the shared useSendDestinationRouter that useInputScreen now
    // calls for the deeplink-prefill direct-navigation path.
    useAllAccounts: vi.fn(() => []),
    useOnChainAccountStateQuery: vi.fn(() => ({
        data: undefined,
        isFetching: false,
        isSuccess: false,
        isError: false,
    })),
    canSignWith: vi.fn(() => false),
}))

const NATIVE_ASSET = vi.hoisted(() => ({ id: '0', decimals: 6 }))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useIsNativeAssetId: () => (id: unknown) => id != null && String(id) === '0',
    isNativeAssetId: (_chainId: string, id: string) => id === '0',
    useAssetsQuery: vi.fn(),
    useAssetPricesQuery: vi.fn(),
    useNativeAsset: () => NATIVE_ASSET,
    toWholeUnits: (value: number | bigint, asset: { decimals: number }) =>
        new Decimal(typeof value === 'bigint' ? value.toString() : value).div(
            new Decimal(10).pow(asset.decimals),
        ),
    isCollectible: () => false,
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useMinFeeForSender: vi.fn(),
}))

// useSendFeeQuery's own branching is pinned in its spec; here it stands on the
// planner fee, as it does on Algorand.
vi.mock('@perawallet/wallet-core-transactions', async () => {
    const { useMinFeeForSender } =
        await import('@perawallet/wallet-core-signing')
    return {
        useSpendableBalanceQuery: vi.fn(),
        // Algorand routes opt-in sends through its send-flow adapter.
        sendFlowChainAdapters: { has: () => true },
        useSendFeeQuery: ({
            senderAddress,
            scope,
        }: {
            senderAddress?: string
            scope: { chainId: 'algorand' }
        }) => {
            const { minFee, isPending } = useMinFeeForSender(
                senderAddress,
                scope.chainId,
            )
            const fee =
                minFee !== undefined
                    ? new Decimal(minFee.toString())
                    : undefined
            return {
                feeAmount: fee,
                maxFeeAmount: fee,
                presets: undefined,
                isPending,
                isError: false,
            }
        },
    }
})

vi.mock('../../useRecipientPoisoningGate', () => ({
    useRecipientPoisoningGate: () => ({
        screenRecipient: () => Promise.resolve(true),
        isScreeningRecipient: false,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: vi.fn(() => ({ errorToast: vi.fn() })),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: vi.fn(() => ({ t: (key: string) => key })),
}))

// Mock the useSendFunds hook
const mockSetAmount = vi.fn()
const mockSetNote = vi.fn()
const mockSetIsCloseAccount = vi.fn()
const mockSetShouldContinueToConfirm = vi.fn()
const mockSendFundsState = {
    selectedAssetId: '0',
    canSelectAsset: true,
    amount: undefined as Decimal | undefined,
    note: undefined,
    destination: undefined as string | undefined,
    shouldContinueToConfirm: false,
    setShouldContinueToConfirm: mockSetShouldContinueToConfirm,
    setSelectedAsset: vi.fn(),
    setCanSelectAsset: vi.fn(),
    setAmount: mockSetAmount,
    setNote: mockSetNote,
    setDestination: vi.fn(),
    setSendMode: vi.fn(),
    setIsCloseAccount: mockSetIsCloseAccount,
    reset: vi.fn(),
}

const mockSendScope = vi.hoisted(() => ({
    current: { chainId: 'algorand', networkId: 'mainnet' },
}))

vi.mock('@modules/transactions/hooks', () => ({
    useSendFunds: vi.fn(() => mockSendFundsState),
    useSendScope: () => mockSendScope.current,
}))

const RESERVE_NOTICE: ChainNotice = {
    title: { key: i18nKey('send_funds.input.min_balance_title') },
    body: [
        {
            key: i18nKey('send_funds.input.min_balance_amount'),
            params: { minBalance: '0.1' },
        },
        { key: i18nKey('send_funds.input.min_balance_body') },
    ],
}
const CLOSE_NOTICE: ChainNotice = {
    title: { key: i18nKey('send_funds.close_account.title') },
    body: [
        {
            key: i18nKey('send_funds.close_account.body'),
            params: { minBalance: '0.1' },
        },
    ],
}

// Amounts are base units, as the chain's adapter returns them.
const spendableOf = ({
    balance,
    max,
    emptyAmount,
    notice,
}: {
    balance: number
    max: number
    emptyAmount?: number
    notice?: 'releasable' | 'firm'
}) => {
    const data: SpendableBalance = {
        balance: new Decimal(balance),
        max: new Decimal(max),
        reserved: new Decimal(balance - max),
        ...(notice
            ? {
                  reserveNotice: {
                      ...RESERVE_NOTICE,
                      isFirm: notice === 'firm',
                  },
              }
            : {}),
        ...(emptyAmount === undefined
            ? {}
            : {
                  emptyAccount: {
                      amount: new Decimal(emptyAmount),
                      notice: CLOSE_NOTICE,
                  },
              }),
    }
    ;(useSpendableBalanceQuery as Mock).mockReturnValue({
        data,
        isPending: false,
    })
}

const sheetProps = (call = 0) =>
    mockRequestBottomSheet.mock.calls[call][0].contents.props

// Every receiver these tests route is a valid address on the send chain.
beforeEach(() => {
    addressCodecs.register({
        ...fixtureCodec,
        chainId: 'algorand',
        isValid: () => true,
    })
})

afterEach(() => {
    addressCodecs.reset()
})

describe('useInputScreen', () => {
    const mockErrorToast = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        mockSendScope.current = { chainId: 'algorand', networkId: 'mainnet' }
        mockSendFundsState.selectedAssetId = '0'
        mockSendFundsState.note = undefined
        mockSendFundsState.destination = undefined
        mockSendFundsState.amount = undefined
        mockSendFundsState.shouldContinueToConfirm = false
        ;(useToast as Mock).mockReturnValue({ errorToast: mockErrorToast })
        ;(useSelectedAccount as Mock).mockReturnValue({
            id: 'test-account',
            custody: { kind: 'local', seed: null },
            chains: { algorand: { address: 'test-addr' } },
        })
        ;(useAssetsQuery as Mock).mockReturnValue({
            data: new Map([
                ['0', { id: '0', decimals: 6 }],
                ['1', { id: '1', decimals: 0 }],
            ]),
        })
        ;(useAssetPricesQuery as Mock).mockReturnValue({
            data: new Map([['0', { usdPrice: new Decimal(1.5) }]]),
        })
        ;(useMinFeeForSender as Mock).mockReturnValue({
            minFee: 1000n,
            isPending: false,
        })
        spendableOf({
            balance: 100_000_000,
            max: 99_899_000,
            notice: 'releasable',
        })
        mockRequestBottomSheet.mockResolvedValue(undefined)
    })

    it("shows the chain's MAX and balance in display units", () => {
        const { result } = renderHook(() => useInputScreen())

        expect(result.current.maxAmount.toString()).toBe('99.899')
        expect(result.current.totalBalance.toString()).toBe('100')
        expect(result.current.isBalanceReady).toBe(true)
    })

    it("converts a token's balance with the token's own decimals", () => {
        mockSendFundsState.selectedAssetId = '1'
        spendableOf({ balance: 50, max: 50 })

        const { result } = renderHook(() => useInputScreen())

        expect(result.current.maxAmount.toString()).toBe('50')
    })

    // A quantum signer pays a multiplied fee, and MAX must reserve the fee the
    // transaction will actually carry.
    it("prices MAX with the sender's own fee", () => {
        ;(useMinFeeForSender as Mock).mockReturnValue({
            minFee: 3000n,
            isPending: false,
        })

        renderHook(() => useInputScreen())

        expect(useSpendableBalanceQuery).toHaveBeenLastCalledWith(
            expect.objectContaining({
                asset: { chainId: 'algorand', assetId: '0' },
                fee: new Decimal(3000),
            }),
        )
    })

    // The fee is a network read that pauses offline; the amount form must
    // still render from the synced balance.
    it('prices MAX without a fee while the fee is still loading', () => {
        ;(useMinFeeForSender as Mock).mockReturnValue({
            minFee: undefined,
            isPending: true,
        })

        const { result } = renderHook(() => useInputScreen())

        expect(useSpendableBalanceQuery).toHaveBeenLastCalledWith(
            expect.objectContaining({ fee: new Decimal(0) }),
        )
        expect(result.current.isBalanceReady).toBe(true)
    })

    it('holds MAX until the fee is known, so it never offers the fee away', () => {
        ;(useMinFeeForSender as Mock).mockReturnValue({
            minFee: undefined,
            isPending: true,
        })

        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setMax()
        })

        expect(result.current.isMaxReady).toBe(false)
        expect(result.current.cryptoValue).toBeFalsy()
    })

    it('is not ready until the spendable balance loads', () => {
        ;(useSpendableBalanceQuery as Mock).mockReturnValue({
            data: undefined,
            isPending: true,
        })

        const { result } = renderHook(() => useInputScreen())

        expect(result.current.isBalanceReady).toBe(false)
    })

    it('handles keypad input correctly', () => {
        const { result } = renderHook(() => useInputScreen())

        act(() => {
            result.current.handleKey('1')
        })
        expect(result.current.cryptoValue).toBe('1')

        act(() => {
            result.current.handleKey('2')
        })
        expect(result.current.cryptoValue).toBe('12')

        act(() => {
            result.current.handleKey()
        })
        expect(result.current.cryptoValue).toBe('1')

        act(() => {
            result.current.handleKey()
        })
        expect(result.current.cryptoValue).toBeFalsy()
    })

    it('validates input on next (error if empty)', async () => {
        const { result } = renderHook(() => useInputScreen())
        await act(async () => {
            await result.current.handleNext()
        })
        expect(mockErrorToast).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            expect.anything(),
        )
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    // Zero-amount ALGO payments are valid on-chain and used for notes and
    // sync pings.
    it('proceeds with a zero amount for ALGO', async () => {
        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('0')
        })
        await act(async () => {
            await result.current.handleNext()
        })
        expect(mockErrorToast).not.toHaveBeenCalled()
        expect(mockSetAmount).toHaveBeenCalled()
        expect(mockSetAmount.mock.calls[0][0].toString()).toBe('0')
        expect(mockNavigate).toHaveBeenCalledWith('SelectDestination')
    })

    it('blocks a zero amount for ASA sends', async () => {
        mockSendFundsState.selectedAssetId = '1'

        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('0')
        })
        await act(async () => {
            await result.current.handleNext()
        })
        expect(mockErrorToast).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            expect.anything(),
        )
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('shows toast when value exceeds total balance', async () => {
        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('120')
        })
        await act(async () => {
            await result.current.handleNext()
        })
        expect(mockErrorToast).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            expect.anything(),
        )
        expect(mockRequestBottomSheet).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it("opens the chain's reserve notice for an amount above MAX", async () => {
        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('99.95')
        })
        await act(async () => {
            await result.current.handleNext()
        })

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        expect(sheetProps().title).toBe('send_funds.input.min_balance_title')
        expect(mockErrorToast).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('continues at MAX when the reserve notice is confirmed', async () => {
        mockRequestBottomSheet.mockResolvedValue(true)

        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('99.95')
        })
        await act(async () => {
            await result.current.handleNext()
        })

        expect(mockSetIsCloseAccount).toHaveBeenCalledWith(false)
        expect(mockSetAmount.mock.calls[0][0].toString()).toBe('99.899')
        expect(result.current.cryptoValue).toBe('99.899')
        expect(mockNavigate).toHaveBeenCalledWith('SelectDestination')
    })

    it('does not navigate when the reserve notice is dismissed', async () => {
        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('99.95')
        })
        await act(async () => {
            await result.current.handleNext()
        })

        expect(mockSetAmount).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('treats an amount above MAX as exceeding the balance on a chain that holds nothing back', async () => {
        spendableOf({ balance: 100_000_000, max: 99_999_000 })

        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('100')
        })
        await act(async () => {
            await result.current.handleNext()
        })

        expect(mockErrorToast).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            expect.anything(),
        )
        expect(mockRequestBottomSheet).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('proceeds on next if valid', async () => {
        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('5')
        })
        await act(async () => {
            await result.current.handleNext()
        })
        expect(mockSetIsCloseAccount).toHaveBeenCalledWith(false)
        expect(mockSetAmount.mock.calls[0][0].toString()).toBe('5')
        expect(mockNavigate).toHaveBeenCalledWith('SelectDestination')
    })

    it('skips the picker and routes straight through when a deeplink prefilled the destination', async () => {
        // Value-bearing deeplink: ALGO receiver already known, so tapping Next
        // must jump straight to Confirm instead of pushing SelectDestination.
        mockSendFundsState.destination = 'RECEIVERADDR'

        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('5')
        })
        await act(async () => {
            await result.current.handleNext()
        })

        expect(mockNavigate).toHaveBeenCalledWith('ConfirmTransaction')
        expect(mockNavigate).not.toHaveBeenCalledWith('SelectDestination')
    })

    it('continues a resumed send to confirmation on its own once balances load', async () => {
        mockSendFundsState.amount = new Decimal('5')
        mockSendFundsState.destination = 'RECEIVERADDR'
        mockSendFundsState.shouldContinueToConfirm = true

        renderHook(() => useInputScreen())
        await act(async () => {})

        expect(mockSetShouldContinueToConfirm).toHaveBeenCalledWith(false)
        expect(mockNavigate).toHaveBeenCalledWith('ConfirmTransaction')
    })

    it('holds a resumed send until the balances it checks against are loaded', async () => {
        mockSendFundsState.amount = new Decimal('5')
        mockSendFundsState.destination = 'RECEIVERADDR'
        mockSendFundsState.shouldContinueToConfirm = true
        ;(useSpendableBalanceQuery as Mock).mockReturnValue({
            data: undefined,
            isPending: true,
        })

        renderHook(() => useInputScreen())
        await act(async () => {})

        expect(mockSetShouldContinueToConfirm).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
        expect(mockErrorToast).not.toHaveBeenCalled()
    })

    // While the fee lands, the last answer (priced without it) is still shown;
    // checking an amount against it would let one fee too much through.
    it('holds a resumed send while MAX is being re-priced', async () => {
        mockSendFundsState.amount = new Decimal('99.8995')
        mockSendFundsState.destination = 'RECEIVERADDR'
        mockSendFundsState.shouldContinueToConfirm = true
        ;(useSpendableBalanceQuery as Mock).mockReturnValue({
            data: {
                balance: new Decimal(100_000_000),
                max: new Decimal(99_900_000),
                reserved: new Decimal(100_000),
            },
            isPending: true,
        })

        const { result } = renderHook(() => useInputScreen())
        await act(async () => {})

        expect(result.current.isBalanceReady).toBe(true)
        expect(mockSetShouldContinueToConfirm).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('holds a resumed send until the fee it is priced with is loaded', async () => {
        mockSendFundsState.amount = new Decimal('5')
        mockSendFundsState.destination = 'RECEIVERADDR'
        mockSendFundsState.shouldContinueToConfirm = true
        ;(useMinFeeForSender as Mock).mockReturnValue({
            minFee: undefined,
            isPending: true,
        })

        renderHook(() => useInputScreen())
        await act(async () => {})

        expect(mockSetShouldContinueToConfirm).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('fills the whole balance on MAX when the chain can release its reserve', () => {
        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setMax()
        })
        expect(result.current.cryptoValue).toBe('100')
        expect(mockSetAmount).not.toHaveBeenCalled()
    })

    it('fills MAX itself when the reserve is firm', () => {
        spendableOf({ balance: 100_000_000, max: 99_899_000, notice: 'firm' })

        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setMax()
        })
        expect(result.current.cryptoValue).toBe('99.899')
    })

    it('fills MAX itself on a chain that holds nothing back', () => {
        spendableOf({ balance: 100_000_000, max: 99_999_000 })

        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setMax()
        })
        expect(result.current.cryptoValue).toBe('99.999')
    })

    it('opens the firm reserve notice, not a close, for an amount above MAX', async () => {
        spendableOf({ balance: 100_000_000, max: 99_899_000, notice: 'firm' })
        mockRequestBottomSheet.mockResolvedValue(true)

        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('99.95')
        })
        await act(async () => {
            await result.current.handleNext()
        })

        expect(sheetProps().title).toBe('send_funds.input.min_balance_title')
        expect(mockSetIsCloseAccount).not.toHaveBeenCalledWith(true)
        expect(mockSetAmount.mock.calls[0][0].toString()).toBe('99.899')
    })

    describe('handlePaste', () => {
        it.each([
            ['12.5', '12.5'],
            ['12,5', '12.5'],
            [' 0.000001 ', '0.000001'],
            ['.5', '0.5'],
            ['007', '7'],
        ])('accepts %j as %j', (pasted, expected) => {
            const { result } = renderHook(() => useInputScreen())

            act(() => {
                result.current.handlePaste(pasted)
            })

            expect(result.current.cryptoValue).toBe(expected)
        })

        it.each(['abc', '1.2.3', '1,234.56', '1.0000001', '-1', '1e3', '.'])(
            'ignores %j and keeps the current amount',
            pasted => {
                const { result } = renderHook(() => useInputScreen())
                act(() => {
                    result.current.handleKey('4')
                })

                act(() => {
                    result.current.handlePaste(pasted)
                })

                expect(result.current.cryptoValue).toBe('4')
            },
        )

        it('rejects a decimal for an asset without decimals', () => {
            mockSendFundsState.selectedAssetId = '1'
            const { result } = renderHook(() => useInputScreen())

            act(() => {
                result.current.handlePaste('2.5')
            })
            expect(result.current.cryptoValue).toBeUndefined()

            act(() => {
                result.current.handlePaste('3')
            })
            expect(result.current.cryptoValue).toBe('3')
        })
    })

    describe('a holding of 3 of a non-unique collectible on another chain', () => {
        const NFT_ID = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D/7'

        beforeEach(() => {
            registerEthereumChain()
            mockSendScope.current = {
                chainId: 'ethereum',
                networkId: 'mainnet',
            }
            mockSendFundsState.selectedAssetId = NFT_ID
            ;(useSelectedAccount as Mock).mockReturnValue({
                id: 'test-account',
                custody: { kind: 'local', seed: null },
                chains: { ethereum: { address: '0xSENDER' } },
            })
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map([
                    [
                        NFT_ID,
                        {
                            assetId: NFT_ID,
                            decimals: 0,
                            peraMetadata: {
                                type: 'collectible',
                                isUnique: false,
                            },
                        },
                    ],
                ]),
            })
            spendableOf({ balance: 3, max: 3 })
        })

        afterEach(() => {
            restoreAlgorandOnlyChains()
        })

        it('refuses a fractional quantity, typed or pasted', () => {
            const { result } = renderHook(() => useInputScreen())

            act(() => {
                result.current.handleKey('1')
            })
            act(() => {
                result.current.handleKey('.')
            })
            act(() => {
                result.current.handleKey('5')
            })
            expect(result.current.cryptoValue).toBe('15')

            const pasted = renderHook(() => useInputScreen())
            act(() => {
                pasted.result.current.handlePaste('1.5')
            })
            expect(pasted.result.current.cryptoValue).toBeUndefined()
        })

        it('refuses 4 before review', async () => {
            const { result } = renderHook(() => useInputScreen())
            act(() => {
                result.current.setCryptoValue('4')
            })
            await act(async () => {
                await result.current.handleNext()
            })

            expect(mockErrorToast).toHaveBeenCalledWith(
                'send_funds.input.exceeds_max_title',
                expect.any(String),
                expect.anything(),
            )
            expect(mockSetAmount).not.toHaveBeenCalled()
            expect(mockNavigate).not.toHaveBeenCalled()
        })

        it('takes 2 on to the receiver', async () => {
            const { result } = renderHook(() => useInputScreen())
            act(() => {
                result.current.setCryptoValue('2')
            })
            await act(async () => {
                await result.current.handleNext()
            })

            expect(mockSetAmount.mock.calls[0][0].toString()).toBe('2')
            expect(mockNavigate).toHaveBeenCalledWith('SelectDestination')
        })
    })

    it('treats leading decimal point as 0.', () => {
        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.handleKey('.')
        })
        expect(result.current.cryptoValue).toBe('0.')
        act(() => {
            result.current.handleKey('5')
        })
        expect(result.current.cryptoValue).toBe('0.5')
    })

    it('ignores second decimal point in keypad input', () => {
        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.handleKey('1')
        })
        act(() => {
            result.current.handleKey('.')
        })
        act(() => {
            result.current.handleKey('.')
        })
        act(() => {
            result.current.handleKey('5')
        })
        expect(result.current.cryptoValue).toBe('1.5')
    })

    it('shows toast when value exceeds zero balance', async () => {
        spendableOf({ balance: 0, max: 0, notice: 'releasable' })

        const { result } = renderHook(() => useInputScreen())
        act(() => {
            result.current.setCryptoValue('0.1')
        })
        await act(async () => {
            await result.current.handleNext()
        })
        expect(mockErrorToast).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            expect.anything(),
        )
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    describe('when the chain offers to empty the account', () => {
        beforeEach(() => {
            spendableOf({
                balance: 100_000_000,
                max: 99_899_000,
                emptyAmount: 99_999_000,
                notice: 'releasable',
            })
        })

        it("opens the close-account choice with the chain's copy", async () => {
            const { result } = renderHook(() => useInputScreen())
            act(() => {
                result.current.setCryptoValue('100')
            })
            await act(async () => {
                await result.current.handleNext()
            })

            expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
            expect(sheetProps().title).toBe('send_funds.close_account.title')
            expect(sheetProps().message).toBe('send_funds.close_account.body')
            expect(mockNavigate).not.toHaveBeenCalled()
        })

        it('sends the amount the chain prices for emptying it when the user closes', async () => {
            mockRequestBottomSheet.mockResolvedValue('close')

            const { result } = renderHook(() => useInputScreen())
            act(() => {
                result.current.setCryptoValue('99.95')
            })
            await act(async () => {
                await result.current.handleNext()
            })

            expect(mockSetIsCloseAccount).toHaveBeenCalledWith(true)
            expect(mockSetAmount.mock.calls[0][0].toString()).toBe('99.999')
            expect(mockNavigate).toHaveBeenCalledWith('SelectDestination')
        })

        it('sends MAX without closing when the user keeps the account open', async () => {
            mockRequestBottomSheet.mockResolvedValue('keepOpen')

            const { result } = renderHook(() => useInputScreen())
            act(() => {
                result.current.setCryptoValue('100')
            })
            await act(async () => {
                await result.current.handleNext()
            })

            expect(mockSetIsCloseAccount).toHaveBeenCalledWith(false)
            expect(mockSetIsCloseAccount).not.toHaveBeenCalledWith(true)
            expect(mockSetAmount.mock.calls[0][0].toString()).toBe('99.899')
            expect(result.current.cryptoValue).toBe('99.899')
            expect(mockNavigate).toHaveBeenCalledWith('SelectDestination')
        })

        it('does nothing when the choice is dismissed', async () => {
            const { result } = renderHook(() => useInputScreen())
            act(() => {
                result.current.setCryptoValue('100')
            })
            await act(async () => {
                await result.current.handleNext()
            })

            expect(mockSetIsCloseAccount).not.toHaveBeenCalledWith(true)
            expect(mockSetAmount).not.toHaveBeenCalled()
            expect(mockNavigate).not.toHaveBeenCalled()
        })

        it('resets the close flag for an amount within MAX', async () => {
            const { result } = renderHook(() => useInputScreen())
            act(() => {
                result.current.setCryptoValue('5')
            })
            await act(async () => {
                await result.current.handleNext()
            })

            expect(mockSetIsCloseAccount).toHaveBeenCalledWith(false)
            expect(mockNavigate).toHaveBeenCalledWith('SelectDestination')
        })
    })
})
