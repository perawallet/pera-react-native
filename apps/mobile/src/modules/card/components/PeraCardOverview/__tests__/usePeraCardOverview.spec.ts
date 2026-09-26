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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import type { CardTransaction } from '@perawallet/wallet-core-chain-algorand/card'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    useAccountAssetBalanceQuery,
    useFindAccountByAddress,
    useSelectedAccountAddress,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

const mockState = vi.hoisted(() => ({
    selectedFundingType: null as string | null,
    connectedAddress: null as string | null,
    transactions: [] as CardTransaction[],
    isLoading: false,
    cardBalance: '0',
    isWalletsLoading: false,
    rewardBalance: null as string | null,
    creditBalance: null as string | null,
}))
const mockInfoToast = vi.fn()
const mockSuccessToast = vi.fn()
const mockTrackEvent = vi.hoisted(() => vi.fn())
const mockNavigate = vi.fn()
const mockSetSelectedAccountAddress = vi.fn()

vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<object>('@react-navigation/native')
    return {
        ...actual,
        // The hook goes through useAppNavigation, which reads all of these
        // off the navigation object at call time — stub them all so the mock
        // doesn't silently hand out undefined.
        useNavigation: () => ({
            navigate: mockNavigate,
            push: vi.fn(),
            replace: vi.fn(),
            goBack: vi.fn(),
            canGoBack: vi.fn(() => true),
            reset: vi.fn(),
        }),
    }
})

vi.mock('@perawallet/wallet-core-chain-algorand/card', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-chain-algorand/card',
    )
    return {
        ...actual,
        useCardStore: (
            selector: (state: {
                selectedFundingType: string | null
                connectedFundingSourceAddress: string | null
            }) => unknown,
        ) =>
            selector({
                selectedFundingType: mockState.selectedFundingType,
                connectedFundingSourceAddress: mockState.connectedAddress,
            }),
        useCardTransactionsQuery: () => ({
            transactions: mockState.transactions,
            isLoading: mockState.isLoading,
        }),
        useCardWalletBalanceQuery: (kind: 'reward' | 'credit') => {
            const balance =
                kind === 'reward'
                    ? mockState.rewardBalance
                    : mockState.creditBalance
            return {
                wallet:
                    balance === null
                        ? null
                        : {
                              id: `${kind}-1`,
                              balance: new Decimal(balance),
                              currency: 'usdc',
                              isWithdrawable: false,
                          },
                isLoading: false,
                isError: false,
                error: null,
                refetch: vi.fn(),
            }
        },
    }
})

const mockWithdraw = vi.hoisted(() => ({
    pending: null as unknown,
    isReady: false,
    complete: vi.fn(),
    cancel: vi.fn(),
    isCompleting: false,
    isCancelling: false,
}))
const mockWithdrawErrorToast = vi.fn()

vi.mock('../../../hooks', async () => ({
    ...(await vi.importActual<object>('../../../hooks')),
    useCardEscrowBalance: () => ({
        balance: new Decimal(mockState.cardBalance),
        isLoading: mockState.isWalletsLoading,
    }),
    useCardWithdraw: () => ({
        pending: mockWithdraw.pending,
        pendingAmount: new Decimal('0.25'),
        secondsUntilReady: 12,
        isReady: mockWithdraw.isReady,
        isPendingLoading: false,
        request: vi.fn(),
        complete: mockWithdraw.complete,
        cancel: mockWithdraw.cancel,
        isRequesting: false,
        isCompleting: mockWithdraw.isCompleting,
        isCancelling: mockWithdraw.isCancelling,
    }),
    useCardErrorToast: () => mockWithdrawErrorToast,
}))

vi.mock('@analytics', async () => {
    const actual = await vi.importActual<object>('@analytics')
    return { ...actual, trackEvent: mockTrackEvent }
})

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        infoToast: mockInfoToast,
        errorToast: vi.fn(),
        successToast: mockSuccessToast,
        showToast: vi.fn(),
    }),
}))

vi.mock('react-i18next', async () => {
    const actual = await vi.importActual<object>('react-i18next')
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string) => key,
            i18n: { changeLanguage: vi.fn(), language: 'en' },
        }),
    }
})

import { usePeraCardOverview } from '../usePeraCardOverview'

const tx = (id: string, dateTime: string): CardTransaction =>
    ({ id, dateTime }) as unknown as CardTransaction

// Auto funding needs a connected account that can sign the AutoDraw LSig, so
// the stored type alone is not enough — the account has to be resolvable.
const LOCAL_ACCOUNT = {
    address: 'LINKED_ADDR',
    type: 'algo25',
    keyPairId: 'key-1',
} as WalletAccount

const LEDGER_ACCOUNT = {
    address: 'LINKED_ADDR',
    type: 'hardware',
    hardwareDetails: { manufacturer: 'ledger' },
} as unknown as WalletAccount

// The linked balances are the funding account's own on-chain holdings, so
// they are driven through the account-balance query rather than through Baanx.
const linkedHoldings = {
    usdc: null as Nullable<string>,
    algo: null as Nullable<string>,
    isPending: false,
}
const holdingOf = (assetId: string, balance: Nullable<string>) =>
    balance === null
        ? null
        : ({ assetId, amount: new Decimal(balance) } as ReturnType<
              typeof useAccountAssetBalanceQuery
          >['data'])
const applyLinkedHoldings = () =>
    vi.mocked(useAccountAssetBalanceQuery).mockImplementation(
        (_, assetId) =>
            ({
                data:
                    assetId === '0'
                        ? holdingOf('0', linkedHoldings.algo)
                        : holdingOf('10458941', linkedHoldings.usdc),
                isPending: linkedHoldings.isPending,
            }) as ReturnType<typeof useAccountAssetBalanceQuery>,
    )
const setLinkedUsdc = (balance: Nullable<string>, isPending = false) => {
    linkedHoldings.usdc = balance
    linkedHoldings.isPending = isPending
    applyLinkedHoldings()
}
const setLinkedAlgo = (balance: Nullable<string>) => {
    linkedHoldings.algo = balance
    applyLinkedHoldings()
}

describe('usePeraCardOverview', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockWithdraw.pending = null
        mockWithdraw.isReady = false
        mockWithdraw.complete.mockResolvedValue(undefined)
        mockWithdraw.cancel.mockResolvedValue(undefined)
        mockState.selectedFundingType = null
        mockState.connectedAddress = 'LINKED_ADDR'
        mockState.transactions = []
        mockState.isLoading = false
        mockState.cardBalance = '0'
        mockState.isWalletsLoading = false
        mockState.rewardBalance = null
        mockState.creditBalance = null
        setLinkedUsdc(null)
        setLinkedAlgo(null)
        vi.mocked(useFindAccountByAddress).mockImplementation(
            address => [LOCAL_ACCOUNT].find(a => a.address === address) ?? null,
        )
        vi.mocked(useSelectedAccountAddress).mockReturnValue({
            selectedAccountAddress: null,
            setSelectedAccountAddress: mockSetSelectedAccountAddress,
        })
    })

    it('reports the balance as loading while the card balance is in flight', () => {
        mockState.isWalletsLoading = true

        const { result } = renderHook(() => usePeraCardOverview())

        expect(result.current.isBalanceLoading).toBe(true)
    })

    it('defaults to manual funding with zero balance and stubbed credits', () => {
        const { result } = renderHook(() => usePeraCardOverview())

        expect(result.current.isAutoFunding).toBe(false)
        expect(result.current.currency).toBe('USDC')
        expect(result.current.balance.toString()).toBe('0')
        expect(result.current.credits.rewards.toString()).toBe('0')
        expect(result.current.credits.refunds.toString()).toBe('0')
    })

    it("exposes the escrow account's USDC as the card balance", () => {
        mockState.cardBalance = '150.25'

        const { result } = renderHook(() => usePeraCardOverview())

        expect(result.current.balance.toFixed(2)).toBe('150.25')
    })

    it('reports auto funding when the selected type is AUTO', () => {
        mockState.selectedFundingType = 'AUTO'

        const { result } = renderHook(() => usePeraCardOverview())

        expect(result.current.isAutoFunding).toBe(true)
    })

    // A Ledger can never sign the AutoDraw LSig, so a stored AUTO left over
    // from a previous account must not be treated as live: it would add a
    // linked balance the card can never actually draw.
    it('ignores a stored AUTO when the connected account is a Ledger', () => {
        mockState.selectedFundingType = 'AUTO'
        setLinkedUsdc('500')
        vi.mocked(useFindAccountByAddress).mockImplementation(
            address =>
                [LEDGER_ACCOUNT].find(a => a.address === address) ?? null,
        )

        const { result } = renderHook(() => usePeraCardOverview())

        expect(result.current.isAutoFunding).toBe(false)
        expect(result.current.balance.toString()).toBe('0')
    })

    it('shows each Baanx wallet balance as its credits row', () => {
        mockState.rewardBalance = '12.34'
        mockState.creditBalance = '5.5'

        const { result } = renderHook(() => usePeraCardOverview())

        expect(result.current.credits.rewards.toFixed(2)).toBe('12.34')
        expect(result.current.credits.refunds.toFixed(2)).toBe('5.50')
    })

    it('groups transactions by month, newest first', () => {
        mockState.transactions = [
            tx('a', '2026-06-10T10:00:00Z'),
            tx('b', '2026-07-15T10:00:00Z'),
        ]

        const { result } = renderHook(() => usePeraCardOverview())

        expect(result.current.transactionSections.map(s => s.key)).toEqual([
            '2026-07',
            '2026-06',
        ])
    })

    it('navigates to the Add Funds screen', () => {
        const { result } = renderHook(() => usePeraCardOverview())

        result.current.onAddFunds()

        expect(mockNavigate).toHaveBeenCalledWith('CardAddFunds')
    })

    it('navigates to the full Transactions screen from "Show all"', () => {
        const { result } = renderHook(() => usePeraCardOverview())

        result.current.onShowAllTransactions()

        expect(mockNavigate).toHaveBeenCalledWith('CardTransactions')
    })

    it('navigates to the Withdraw screen', () => {
        const { result } = renderHook(() => usePeraCardOverview())

        result.current.onWithdraw()

        expect(mockNavigate).toHaveBeenCalledWith('CardWithdraw')
    })

    // Rewards are earned on purchases whatever tops the card up, so this has to
    // work on manual funding too, where the credits section used to be hidden.
    it.each([
        ['reward', 'card_home_rewards'],
        ['credit', 'card_home_refunds'],
    ] as const)(
        'opens the %s wallet screen from its credits row',
        (kind, event) => {
            const { result } = renderHook(() => usePeraCardOverview())

            result.current.onCreditPress(kind)

            expect(mockNavigate).toHaveBeenCalledWith('CardWalletBalance', {
                kind,
            })
            expect(mockTrackEvent).toHaveBeenCalledWith(event)
            expect(mockInfoToast).not.toHaveBeenCalled()
        },
    )

    // Under auto funding the card spends from the linked account, so topping
    // up means buying USDC into that account, which the Fund tab only does for
    // whichever account is selected.
    it('selects the linked account and opens the Fund tab when it holds no ALGO', () => {
        mockState.selectedFundingType = 'AUTO'
        setLinkedAlgo('0')
        const { result } = renderHook(() => usePeraCardOverview())

        result.current.onFundLinkedAccount()

        expect(mockSetSelectedAccountAddress).toHaveBeenCalledWith(
            'LINKED_ADDR',
        )
        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Fund',
            params: { destinationTokenId: 'USDC_ALGORAND' },
        })
        expect(mockInfoToast).not.toHaveBeenCalled()
    })

    // Swapping is the shortest route to USDC when there is ALGO to swap, and
    // the Swap tab reads the selected account too.
    it('opens the Swap tab from ALGO to USDC when the linked account holds ALGO', () => {
        mockState.selectedFundingType = 'AUTO'
        setLinkedAlgo('12.5')
        const { result } = renderHook(() => usePeraCardOverview())

        result.current.onFundLinkedAccount()

        expect(mockSetSelectedAccountAddress).toHaveBeenCalledWith(
            'LINKED_ADDR',
        )
        // The spec runs on the default (mainnet) network, where USDC is 31566704.
        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Swap',
            params: { assetInId: '0', assetOutId: '31566704' },
        })
    })

    it('does nothing when the linked account is not in the wallet', () => {
        mockState.connectedAddress = null
        const { result } = renderHook(() => usePeraCardOverview())

        result.current.onFundLinkedAccount()

        expect(mockSetSelectedAccountAddress).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    describe('balance display with auto funding', () => {
        it('ignores the linked balance on manual funding', () => {
            mockState.selectedFundingType = 'MANUAL'
            mockState.cardBalance = '240'
            setLinkedUsdc('1000')

            const { result } = renderHook(() => usePeraCardOverview())

            expect(result.current.balance.toFixed()).toBe('240')
        })

        it('adds the linked balance on auto funding', () => {
            mockState.selectedFundingType = 'AUTO'
            mockState.cardBalance = '240'
            setLinkedUsdc('1000')

            const { result } = renderHook(() => usePeraCardOverview())

            expect(result.current.balance.toFixed()).toBe('1240')
        })

        it('waits for the linked balance only when auto funding is on', () => {
            setLinkedUsdc(null, true)

            mockState.selectedFundingType = 'MANUAL'
            const manual = renderHook(() => usePeraCardOverview())
            expect(manual.result.current.isBalanceLoading).toBe(false)

            mockState.selectedFundingType = 'AUTO'
            const auto = renderHook(() => usePeraCardOverview())
            expect(auto.result.current.isBalanceLoading).toBe(true)
        })
    })
    describe('withdraw button state', () => {
        it('opens the withdraw form while no request is open', () => {
            const { result } = renderHook(() => usePeraCardOverview())

            expect(result.current.withdrawState).toBe('idle')
            result.current.onWithdraw()
            expect(mockNavigate).toHaveBeenCalledWith('CardWithdraw')
        })

        it('leads to the open request while it is still maturing', () => {
            mockWithdraw.pending = { amount: 250_000n }

            const { result } = renderHook(() => usePeraCardOverview())

            expect(result.current.withdrawState).toBe('waiting')
            result.current.onWithdraw()
            expect(mockNavigate).toHaveBeenCalledWith('CardWithdrawStatus')
        })

        it('offers to complete once the request has matured', () => {
            mockWithdraw.pending = { amount: 250_000n }
            mockWithdraw.isReady = true

            const { result } = renderHook(() => usePeraCardOverview())

            expect(result.current.withdrawState).toBe('ready')
        })
    })
})
