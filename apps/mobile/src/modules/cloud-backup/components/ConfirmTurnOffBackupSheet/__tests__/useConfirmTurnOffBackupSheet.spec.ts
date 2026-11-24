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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useConfirmTurnOffBackupSheet } from '../useConfirmTurnOffBackupSheet'

const HOME_SCOPE = { chainId: 'algorand', networkId: 'mainnet' }

const { resolveMock, dismissMock, atRiskMock, totalsMock, usdToPreferredMock } =
    vi.hoisted(() => ({
        resolveMock: vi.fn(),
        dismissMock: vi.fn(),
        atRiskMock: vi.fn(),
        totalsMock: vi.fn(),
        usdToPreferredMock: vi.fn(),
    }))

const storeAccounts: WalletAccount[] = [
    {
        id: 'a',
        name: 'Account A',
        custody: { kind: 'local', seed: null },
        chains: { algorand: { address: 'A', keyPairId: 'kp-a' } },
    },
    {
        id: 'b',
        name: 'Account B',
        custody: { kind: 'local', seed: null },
        chains: { algorand: { address: 'B', keyPairId: 'kp-b' } },
    },
]

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({
        resolve: resolveMock,
        dismiss: dismissMock,
    }),
}))
vi.mock('@hooks/useHomeChainScope', () => ({
    useHomeChainScope: () => HOME_SCOPE,
}))
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: (
        selector: (state: { accounts: WalletAccount[] }) => unknown,
    ) => selector({ accounts: storeAccounts }),
    useAccountValueTotalsQuery: (...args: unknown[]) => totalsMock(...args),
}))
vi.mock('@perawallet/wallet-core-backup', () => ({
    useFundedAccountsRequiringMnemonicBackupQuery: (...args: unknown[]) =>
        atRiskMock(...args),
}))
vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: () => ({ usdToPreferred: usdToPreferredMock }),
}))

const noRisk = { accounts: [] as WalletAccount[], isPending: false }

describe('useConfirmTurnOffBackupSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        atRiskMock.mockReturnValue(noRisk)
        totalsMock.mockReturnValue({ portfolioFiatValue: null })
        usdToPreferredMock.mockImplementation((value: Decimal | null) =>
            value ? value.times(2) : null,
        )
    })

    test('leaves turning off enabled when no acknowledgement is required', () => {
        const { result } = renderHook(() => useConfirmTurnOffBackupSheet(false))

        expect(result.current.isTurnOffDisabled).toBe(false)
    })

    test('keeps turning off disabled until the acknowledgement is ticked', () => {
        const { result } = renderHook(() => useConfirmTurnOffBackupSheet(true))

        expect(result.current.isAcknowledged).toBe(false)
        expect(result.current.isTurnOffDisabled).toBe(true)

        act(() => result.current.toggleAcknowledged())

        expect(result.current.isAcknowledged).toBe(true)
        expect(result.current.isTurnOffDisabled).toBe(false)
    })

    test('disables turning off again when the acknowledgement is unticked', () => {
        const { result } = renderHook(() => useConfirmTurnOffBackupSheet(true))

        act(() => result.current.toggleAcknowledged())
        act(() => result.current.toggleAcknowledged())

        expect(result.current.isTurnOffDisabled).toBe(true)
    })

    test('disables turning off while the at-risk lookup is pending', () => {
        atRiskMock.mockReturnValue({ accounts: [], isPending: true })

        const { result } = renderHook(() => useConfirmTurnOffBackupSheet(false))

        expect(result.current.isTurnOffDisabled).toBe(true)
    })

    test('looks for at-risk accounts among the stored accounts on the home scope', () => {
        renderHook(() => useConfirmTurnOffBackupSheet(false))

        expect(atRiskMock).toHaveBeenCalledWith(storeAccounts, HOME_SCOPE)
    })

    test('totals the at-risk accounts in the preferred currency', () => {
        atRiskMock.mockReturnValue({
            accounts: [storeAccounts[0]],
            isPending: false,
        })
        totalsMock.mockReturnValue({ portfolioFiatValue: new Decimal('6.2') })

        const { result } = renderHook(() => useConfirmTurnOffBackupSheet(false))

        expect(totalsMock).toHaveBeenCalledWith(
            [storeAccounts[0]],
            HOME_SCOPE,
            true,
        )
        expect(result.current.accountsAtRisk).toEqual([storeAccounts[0]])
        expect(result.current.accountsAtRiskPreferredValue).toEqual(
            new Decimal('12.4'),
        )
    })

    test('does not read totals when nothing is at risk', () => {
        renderHook(() => useConfirmTurnOffBackupSheet(false))

        expect(totalsMock).toHaveBeenCalledWith([], HOME_SCOPE, false)
    })

    test('has no preferred value while the rate or price is unknown', () => {
        atRiskMock.mockReturnValue({
            accounts: [storeAccounts[0]],
            isPending: false,
        })
        totalsMock.mockReturnValue({ portfolioFiatValue: new Decimal(5) })
        usdToPreferredMock.mockReturnValue(null)

        const { result } = renderHook(() => useConfirmTurnOffBackupSheet(false))

        expect(result.current.accountsAtRiskPreferredValue).toBeNull()
        expect(result.current.accountsAtRisk).toHaveLength(1)
    })

    test('resolves turn off, dismisses on cancel', () => {
        const { result } = renderHook(() => useConfirmTurnOffBackupSheet(false))

        act(() => result.current.handleTurnOff())
        expect(resolveMock).toHaveBeenCalledWith({ kind: 'turnOff' })

        act(() => result.current.handleCancel())
        expect(dismissMock).toHaveBeenCalledTimes(1)
    })

    test('backs up the first at-risk account first', () => {
        atRiskMock.mockReturnValue({
            accounts: [storeAccounts[1], storeAccounts[0]],
            isPending: false,
        })

        const { result } = renderHook(() => useConfirmTurnOffBackupSheet(false))
        act(() => result.current.handleBackUpFirst())

        expect(resolveMock).toHaveBeenCalledWith({
            kind: 'backUpFirst',
            account: storeAccounts[1],
        })
    })

    test('does nothing when asked to back up first with nothing at risk', () => {
        const { result } = renderHook(() => useConfirmTurnOffBackupSheet(false))

        act(() => result.current.handleBackUpFirst())

        expect(resolveMock).not.toHaveBeenCalled()
    })
})
