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
import type { CardTransaction } from '@perawallet/wallet-core-card'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    useAccountAssetBalanceQuery,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

const mockState = vi.hoisted(() => ({
    selectedFundingType: null as string | null,
    connectedAddress: null as string | null,
    transactions: [] as CardTransaction[],
    isLoading: false,
    cardBalance: '0',
    isWalletsLoading: false,
    delegatedWallet: null as unknown,
    rewardBalance: null as string | null,
}))
const mockExternalWalletsParams: { enabled?: boolean }[] = []
const mockInfoToast = vi.fn()
const mockNavigate = vi.fn()

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

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<object>('@perawallet/wallet-core-card')
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
        useCardRewardWalletQuery: () => ({
            rewardWallet:
                mockState.rewardBalance === null
                    ? null
                    : {
                          id: 'reward-1',
                          balance: new Decimal(mockState.rewardBalance),
                          currency: 'usdc',
                          isWithdrawable: false,
                      },
            isLoading: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
        }),
        useCardExternalWalletsQuery: (params: { enabled?: boolean }) => {
            mockExternalWalletsParams.push(params)
            return {
                delegatedWallet: mockState.delegatedWallet,
                hasActiveDelegation: false,
                isLoading: false,
                isError: false,
                error: null,
                refetch: vi.fn(),
            }
        },
    }
})

vi.mock('../../../hooks', async () => ({
    ...(await vi.importActual<object>('../../../hooks')),
    useCardEscrowBalance: () => ({
        balance: new Decimal(mockState.cardBalance),
        isLoading: mockState.isWalletsLoading,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        infoToast: mockInfoToast,
        errorToast: vi.fn(),
        successToast: vi.fn(),
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

// The linked balance is the funding account's own on-chain USDC holding, so
// it is driven through the account-balance query rather than through Baanx.
const setLinkedUsdc = (balance: Nullable<string>, isPending = false) =>
    vi.mocked(useAccountAssetBalanceQuery).mockReturnValue({
        data:
            balance === null
                ? null
                : ({
                      assetId: '10458941',
                      amount: new Decimal(balance),
                  } as ReturnType<typeof useAccountAssetBalanceQuery>['data']),
        isPending,
    } as ReturnType<typeof useAccountAssetBalanceQuery>)

describe('usePeraCardOverview', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockState.selectedFundingType = null
        mockState.connectedAddress = 'LINKED_ADDR'
        mockState.transactions = []
        mockState.isLoading = false
        mockState.cardBalance = '0'
        mockState.isWalletsLoading = false
        mockState.delegatedWallet = null
        mockState.rewardBalance = null
        mockExternalWalletsParams.length = 0
        setLinkedUsdc(null)
        vi.mocked(useAllAccounts).mockReturnValue([LOCAL_ACCOUNT])
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
        expect(result.current.credits.cashbacks.toString()).toBe('0')
        expect(result.current.credits.refunds.toString()).toBe('0')
    })

    it("exposes the escrow account's USDC as the card balance", () => {
        mockState.cardBalance = '150.25'

        const { result } = renderHook(() => usePeraCardOverview())

        expect(result.current.balance.toFixed(2)).toBe('150.25')
    })

    // Baanx only knows about a delegation under auto funding, so asking for one
    // on manual is a guaranteed 400.
    it('asks Baanx for the delegation only when auto funding is on', () => {
        renderHook(() => usePeraCardOverview())
        expect(mockExternalWalletsParams.at(-1)?.enabled).toBe(false)

        mockState.selectedFundingType = 'AUTO'
        renderHook(() => usePeraCardOverview())
        expect(mockExternalWalletsParams.at(-1)?.enabled).toBe(true)
    })

    it('reports auto funding when the selected type is AUTO', () => {
        mockState.selectedFundingType = 'AUTO'

        const { result } = renderHook(() => usePeraCardOverview())

        expect(result.current.isAutoFunding).toBe(true)
    })

    // A Ledger can never sign the AutoDraw LSig, so a stored AUTO left over
    // from a previous account must not be treated as live: it would add the
    // linked balance and the per-tx limit to a spendable amount the card can
    // never actually draw.
    it('ignores a stored AUTO when the connected account is a Ledger', () => {
        mockState.selectedFundingType = 'AUTO'
        mockState.delegatedWallet = { allowance: new Decimal('200') }
        setLinkedUsdc('500')
        vi.mocked(useAllAccounts).mockReturnValue([LEDGER_ACCOUNT])

        const { result } = renderHook(() => usePeraCardOverview())

        expect(result.current.isAutoFunding).toBe(false)
        expect(result.current.spendablePerTx.toString()).toBe('0')
    })

    // The credits row used to be a hardcoded zero while the Cashback screen read
    // the real wallet, so the two disagreed the moment any reward landed.
    it('shows the reward wallet balance as cashback credits', () => {
        mockState.rewardBalance = '12.34'

        const { result } = renderHook(() => usePeraCardOverview())

        expect(result.current.credits.cashbacks.toFixed(2)).toBe('12.34')
        expect(result.current.credits.refunds.toString()).toBe('0')
    })

    // Cashback sits in a separate Baanx wallet that has to be withdrawn first,
    // so counting it would promise more per transaction than the card can draw.
    it('leaves cashback out of the spendable-per-transaction figure', () => {
        mockState.cardBalance = '240'
        mockState.rewardBalance = '50'

        const { result } = renderHook(() => usePeraCardOverview())

        expect(result.current.balance.toFixed()).toBe('240')
        expect(result.current.spendablePerTx.toFixed()).toBe('240')
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

    // Cashback is earned on purchases whatever tops the card up, so this has to
    // work on manual funding too, where the credits section used to be hidden.
    it('navigates to the Cashback screen from a credit row', () => {
        const { result } = renderHook(() => usePeraCardOverview())

        result.current.onCreditPress()

        expect(mockNavigate).toHaveBeenCalledWith('CardCashback')
        expect(mockInfoToast).not.toHaveBeenCalled()
    })

    it('unwired action handlers surface the coming-soon toast', () => {
        const { result } = renderHook(() => usePeraCardOverview())

        result.current.onGetUsdc()

        expect(mockInfoToast).toHaveBeenCalled()
    })

    describe('balance display with auto funding', () => {
        const allowanceOf = (allowance: string) => ({
            address: 'LINKED_ADDR',
            currency: 'usdc',
            balance: new Decimal('0'),
            allowance: new Decimal(allowance),
            network: 'algorand',
        })

        it('ignores the linked balance on manual funding', () => {
            mockState.selectedFundingType = 'MANUAL'
            mockState.cardBalance = '240'
            mockState.delegatedWallet = allowanceOf('400')
            setLinkedUsdc('1000')

            const { result } = renderHook(() => usePeraCardOverview())

            expect(result.current.balance.toFixed()).toBe('240')
            // Spendable = card balance + credits (0), no auto-funding leg.
            expect(result.current.spendablePerTx.toFixed()).toBe('240')
        })

        it('adds the linked balance and caps the per-tx leg at the allowance', () => {
            mockState.selectedFundingType = 'AUTO'
            mockState.cardBalance = '240'
            mockState.delegatedWallet = allowanceOf('400')
            setLinkedUsdc('1000')

            const { result } = renderHook(() => usePeraCardOverview())

            expect(result.current.balance.toFixed()).toBe('1240')
            // min(400 allowance, 1000 linked) + 240 card + 0 credits.
            expect(result.current.spendablePerTx.toFixed()).toBe('640')
        })

        // Baanx serves the external-wallet route to custodial platforms only,
        // so the linked balance has to survive that query returning nothing.
        it('shows the linked balance even when Baanx reports no wallet', () => {
            mockState.selectedFundingType = 'AUTO'
            mockState.delegatedWallet = null
            setLinkedUsdc('1')

            const { result } = renderHook(() => usePeraCardOverview())

            expect(result.current.balance.toFixed()).toBe('1')
            // Falls back to the app per-tx limit, so the whole 1 is spendable.
            expect(result.current.spendablePerTx.toFixed()).toBe('1')
        })

        it('caps the per-tx leg at the linked balance when it is lower', () => {
            mockState.selectedFundingType = 'AUTO'
            mockState.cardBalance = '240'
            mockState.delegatedWallet = allowanceOf('400')
            setLinkedUsdc('150')

            const { result } = renderHook(() => usePeraCardOverview())

            // min(400, 150 linked) + 240 card.
            expect(result.current.spendablePerTx.toFixed()).toBe('390')
        })

        it('falls back to the app per-tx limit when no allowance is reported', () => {
            mockState.selectedFundingType = 'AUTO'
            mockState.cardBalance = '240'
            mockState.delegatedWallet = allowanceOf('0')
            setLinkedUsdc('1000')

            const { result } = renderHook(() => usePeraCardOverview())

            // min(constant 400, 1000 linked) + 240 card.
            expect(result.current.spendablePerTx.toFixed()).toBe('640')
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
})
