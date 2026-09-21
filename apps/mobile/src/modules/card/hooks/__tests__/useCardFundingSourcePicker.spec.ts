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
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

// The global setup stubs the account-type helpers with looser shapes — use
// the real ones so the eligibility filter is tested for real.
vi.mock('@perawallet/wallet-core-accounts', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-accounts')),
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

const account = (
    address: string,
    type: WalletAccount['type'],
    extra: Partial<WalletAccount> = {},
): WalletAccount => ({ address, type, ...extra }) as WalletAccount

beforeEach(() => {
    vi.clearAllMocks()
    mockConnectedAddress = null
})

describe('isEligibleFundingSource', () => {
    it('accepts standard / HD / Ledger and rejects watch, multisig, rekeyed', () => {
        expect(isEligibleFundingSource(account('A', 'algo25'))).toBe(true)
        expect(isEligibleFundingSource(account('B', 'hdWallet'))).toBe(true)
        expect(isEligibleFundingSource(account('C', 'hardware'))).toBe(true)
        expect(isEligibleFundingSource(account('D', 'watch'))).toBe(false)
        expect(isEligibleFundingSource(account('E', 'multisig'))).toBe(false)
        expect(
            isEligibleFundingSource(
                account('F', 'algo25', { rekeyAddress: 'X' }),
            ),
        ).toBe(false)
    })
})

describe('isSigningCapableFundingSource', () => {
    it('accepts local-key and Ledger accounts, and needs a signing key', () => {
        expect(
            isSigningCapableFundingSource(
                account('A', 'algo25', { keyPairId: 'k1' }),
            ),
        ).toBe(true)
        expect(
            isSigningCapableFundingSource(
                account('B', 'hdWallet', { keyPairId: 'k2' }),
            ),
        ).toBe(true)
        // Ledger signs the creation proof on-device; it carries no keyPairId.
        expect(isSigningCapableFundingSource(account('C', 'hardware'))).toBe(
            true,
        )
        // A local-key type with no keyPairId can't sign at all.
        expect(isSigningCapableFundingSource(account('D', 'algo25'))).toBe(
            false,
        )
        expect(isSigningCapableFundingSource(account('E', 'watch'))).toBe(false)
    })
})

describe('canAutoFund', () => {
    it('allows local-key accounts and rejects Ledger (cannot sign the LSig)', () => {
        expect(canAutoFund(account('A', 'algo25', { keyPairId: 'k1' }))).toBe(
            true,
        )
        expect(canAutoFund(account('B', 'hdWallet', { keyPairId: 'k2' }))).toBe(
            true,
        )
        // Ledger creates cards but can never sign an LSig.
        expect(canAutoFund(account('C', 'hardware'))).toBe(false)
        expect(canAutoFund(account('D', 'algo25'))).toBe(false)
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
            selectedAddress: string | null
        }
        expect(props.headerContent).toBeTruthy()
        // The card header supplies its own title row, so the shared one (with
        // its Sort button) must stay hidden.
        expect(props.hideDefaultHeader).toBe(true)
        expect(props.accountFilter).toBe(isEligibleFundingSource)
        // Fresh pick: nothing connected yet → no account pre-highlighted.
        expect(props.selectedAddress).toBeNull()
    })

    it('threads a custom account filter through to the menu', async () => {
        mockRequest.mockResolvedValue(undefined)
        const { result } = renderHook(() =>
            useCardFundingSourcePicker({
                accountFilter: isSigningCapableFundingSource,
            }),
        )

        await result.current.pickFundingSource()

        const props = mockRequest.mock.calls[0][0].contents.props as {
            accountFilter: (account: WalletAccount) => boolean
        }
        expect(props.accountFilter).toBe(isSigningCapableFundingSource)
    })

    it('highlights the connected funding source when one exists', async () => {
        mockConnectedAddress = 'ADDR1'
        mockRequest.mockResolvedValue(undefined)
        const { result } = renderHook(() => useCardFundingSourcePicker())

        await result.current.pickFundingSource()

        const props = mockRequest.mock.calls[0][0].contents.props as {
            selectedAddress: string | null
        }
        expect(props.selectedAddress).toBe('ADDR1')
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
