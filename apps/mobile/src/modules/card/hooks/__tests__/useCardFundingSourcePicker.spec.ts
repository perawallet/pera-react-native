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
    useAccountChainStateStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// The global setup stubs the account-type helpers with looser shapes — use
// the real ones so the eligibility filter is tested for real.
let mockAllAccounts: WalletAccount[] = []
vi.mock('@perawallet/wallet-core-accounts', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-accounts')),
    useAllAccounts: () => mockAllAccounts,
}))

let mockConnectedAddress: string | null = null
vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<object>('@perawallet/wallet-core-card')
    return {
        ...actual,
        useCardStore: (
            selector: (state: {
                connectedFundingSourceAddress: string | null
            }) => unknown,
        ) =>
            selector({
                connectedFundingSourceAddress: mockConnectedAddress,
            }),
    }
})

const mockRequest = vi.fn()
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequest,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

vi.mock('@modules/accounts/components/AccountMenuContent', () => ({
    AccountMenuContent: () => null,
}))

vi.mock('../../components/ConnectAccountHeader', () => ({
    ConnectAccountHeader: () => null,
}))

const mockHandleCreateAccount = vi.fn()
vi.mock('../useCardAddAccount', () => ({
    useCardAddAccount: () => ({
        handleCreateAccount: mockHandleCreateAccount,
    }),
}))

import {
    canAutoFund,
    isEligibleFundingSource,
    isSigningCapableFundingSource,
    useCardFundingSourcePicker,
} from '../useCardFundingSourcePicker'
import {
    registerAlgorandAccountsAdapter,
    seedAuthority,
} from '@test-utils/algorandAccountsAdapter'
import {
    custodyForType,
    type AlgorandAccountKind,
} from '@test-utils/accountCustody'
import { registerAlgorandCardAdapter } from '@test-utils/cardChainAdapter'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'

const SCOPE = scopeForLegacyNetwork('mainnet')

const account = (
    address: string,
    type: AlgorandAccountKind,
    { keyPairId }: { keyPairId?: string } = {},
): WalletAccount => ({
    id: address,
    custody: custodyForType(type),
    chains: { algorand: { address, ...(keyPairId ? { keyPairId } : {}) } },
})

beforeEach(() => {
    registerAlgorandAccountsAdapter()
    registerAlgorandCardAdapter()
    useAccountChainStateStore.getState().resetState()
    vi.clearAllMocks()
    mockConnectedAddress = null
    mockAllAccounts = []
})

describe('isEligibleFundingSource', () => {
    it('accepts standard / HD / Ledger and rejects watch, multisig, rekeyed', () => {
        expect(isEligibleFundingSource(account('A', 'standalone'), SCOPE)).toBe(
            true,
        )
        expect(isEligibleFundingSource(account('B', 'hdWallet'), SCOPE)).toBe(
            true,
        )
        expect(isEligibleFundingSource(account('C', 'hardware'), SCOPE)).toBe(
            true,
        )
        expect(isEligibleFundingSource(account('D', 'watch'), SCOPE)).toBe(
            false,
        )
        expect(isEligibleFundingSource(account('E', 'multisig'), SCOPE)).toBe(
            false,
        )
        seedAuthority('F', 'X')
        expect(isEligibleFundingSource(account('F', 'standalone'), SCOPE)).toBe(
            false,
        )
    })

    it('rejects an account that holds no address on the card chain', () => {
        const elsewhere: WalletAccount = {
            id: 'G',
            custody: custodyForType('standalone'),
            chains: { ethereum: { address: '0xG' } },
        }
        expect(isEligibleFundingSource(elsewhere, SCOPE)).toBe(false)
    })
})

describe('isSigningCapableFundingSource', () => {
    it('accepts local-key and Ledger accounts, and needs a signing key', () => {
        expect(
            isSigningCapableFundingSource(
                account('A', 'standalone', { keyPairId: 'k1' }),
                SCOPE,
            ),
        ).toBe(true)
        expect(
            isSigningCapableFundingSource(
                account('B', 'hdWallet', { keyPairId: 'k2' }),
                SCOPE,
            ),
        ).toBe(true)
        // Ledger signs the creation proof on-device; it carries no keyPairId.
        expect(
            isSigningCapableFundingSource(account('C', 'hardware'), SCOPE),
        ).toBe(true)
        // A local-key type with no keyPairId can't sign at all.
        expect(
            isSigningCapableFundingSource(account('D', 'standalone'), SCOPE),
        ).toBe(false)
        expect(
            isSigningCapableFundingSource(account('E', 'watch'), SCOPE),
        ).toBe(false)
    })
})

describe('canAutoFund', () => {
    it('allows local-key accounts and rejects Ledger (cannot sign the delegation)', () => {
        expect(
            canAutoFund(account('A', 'standalone', { keyPairId: 'k1' }), SCOPE),
        ).toBe(true)
        expect(
            canAutoFund(account('B', 'hdWallet', { keyPairId: 'k2' }), SCOPE),
        ).toBe(true)
        // Ledger creates cards but can never sign the delegation.
        expect(canAutoFund(account('C', 'hardware'), SCOPE)).toBe(false)
        expect(canAutoFund(account('D', 'standalone'), SCOPE)).toBe(false)
    })
})

describe('useCardFundingSourcePicker', () => {
    it('opens the account menu with the card header and the funding filter', async () => {
        mockRequest.mockResolvedValue(undefined)
        const { result } = renderHook(() => useCardFundingSourcePicker())

        await result.current.pickFundingSource()

        const props = mockRequest.mock.calls[0][0].contents.props as {
            headerContent: unknown
            hideDefaultHeader: boolean
            accountFilter: (account: WalletAccount) => boolean
            selectedAccountId: string | null
        }
        expect(props.headerContent).toBeTruthy()
        // The card header supplies its own title row, so the shared one (with
        // its Sort button) must stay hidden.
        expect(props.hideDefaultHeader).toBe(true)
        expect(props.accountFilter(account('A', 'standalone'))).toBe(true)
        expect(props.accountFilter(account('D', 'watch'))).toBe(false)
        // Fresh pick: nothing connected yet → no account pre-highlighted.
        expect(props.selectedAccountId).toBeNull()
    })

    it('threads a custom account filter through to the menu', async () => {
        mockRequest.mockResolvedValue(undefined)
        const accountFilter = vi.fn(() => false)
        const { result } = renderHook(() =>
            useCardFundingSourcePicker({ accountFilter }),
        )

        await result.current.pickFundingSource()

        const props = mockRequest.mock.calls[0][0].contents.props as {
            accountFilter: (account: WalletAccount) => boolean
        }
        const candidate = account('A', 'standalone')
        expect(props.accountFilter(candidate)).toBe(false)
        expect(accountFilter).toHaveBeenCalledWith(candidate)
    })

    it('highlights the connected funding source when one exists', async () => {
        mockConnectedAddress = 'ADDR1'
        mockAllAccounts = [account('ADDR1', 'hdWallet')]
        mockRequest.mockResolvedValue(undefined)
        const { result } = renderHook(() => useCardFundingSourcePicker())

        await result.current.pickFundingSource()

        const props = mockRequest.mock.calls[0][0].contents.props as {
            selectedAccountId: string | null
        }
        expect(props.selectedAccountId).toBe('ADDR1')
    })

    it('resolves with the chosen account', async () => {
        const chosen = account('ADDR1', 'hdWallet')
        mockRequest.mockResolvedValue({ kind: 'selected', account: chosen })
        const { result } = renderHook(() => useCardFundingSourcePicker())

        await expect(result.current.pickFundingSource()).resolves.toBe(chosen)
    })

    it('resolves null when the sheet is dismissed', async () => {
        mockRequest.mockResolvedValue(undefined)
        const { result } = renderHook(() => useCardFundingSourcePicker())

        await expect(result.current.pickFundingSource()).resolves.toBeNull()
    })

    it('runs the add-account flow and resolves null', async () => {
        mockRequest.mockResolvedValue({ kind: 'add-account' })
        const { result } = renderHook(() => useCardFundingSourcePicker())

        await expect(result.current.pickFundingSource()).resolves.toBeNull()
        expect(mockHandleCreateAccount).toHaveBeenCalled()
    })

    it('does not open a sort sheet: the card picker offers no sorting', async () => {
        mockRequest.mockResolvedValue({ kind: 'sort' })
        const { result } = renderHook(() => useCardFundingSourcePicker())

        await expect(result.current.pickFundingSource()).resolves.toBeNull()
        expect(mockRequest).toHaveBeenCalledTimes(1)
    })
})
