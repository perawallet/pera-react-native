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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { TransactionWarning } from '@perawallet/wallet-core-signing'
import { useWarningItem } from '../useWarningItem'

const mockT = vi.hoisted(() => vi.fn((key: string) => key))
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: mockT }),
}))

const ETH_SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'sepolia' }
const ALGO_SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

const closeAccount: TransactionWarning = {
    type: 'close-account',
    senderAddress: 'SENDER',
    targetAddress: 'TARGET',
}

describe('useWarningItem', () => {
    beforeEach(() => {
        mockT.mockClear()
    })

    it('shows an EVM high fee in ETH with 18 decimals', () => {
        const warning: TransactionWarning = {
            type: 'high-fee',
            totalFee: 1_500_000_000_000_000_000n,
        }

        const { result } = renderHook(() =>
            useWarningItem({ warning, isGroup: false, scope: ETH_SCOPE }),
        )

        expect(result.current.icon).toBe('info')
        expect(mockT).toHaveBeenCalledWith(
            'transactions.warning.high_fee_warning',
            { fee: '1.50 ETH' },
        )
    })

    it('shows an Algorand high fee in ALGO with 6 decimals', () => {
        const warning: TransactionWarning = {
            type: 'high-fee',
            totalFee: 2_000_000n,
        }

        renderHook(() =>
            useWarningItem({ warning, isGroup: false, scope: ALGO_SCOPE }),
        )

        expect(mockT).toHaveBeenCalledWith(
            'transactions.warning.high_fee_warning',
            { fee: '2.00 ALGO' },
        )
    })

    it('uses the single-transaction copy for a close-account warning', () => {
        const { result } = renderHook(() =>
            useWarningItem({
                warning: closeAccount,
                isGroup: false,
                scope: ALGO_SCOPE,
            }),
        )

        expect(result.current.icon).toBe('trash')
        expect(mockT).toHaveBeenCalledWith(
            'transactions.warning.close_account_warning',
            { address: 'TARGET' },
        )
        expect(mockT).toHaveBeenCalledWith(
            'transactions.warning.from_account',
            { address: 'SENDER' },
        )
    })

    it('uses the close-asset copy and icon for a close-asset warning', () => {
        const { result } = renderHook(() =>
            useWarningItem({
                warning: { ...closeAccount, type: 'close-asset' },
                isGroup: false,
                scope: ALGO_SCOPE,
            }),
        )

        expect(result.current.icon).toBe('unlink')
        expect(result.current.emphasis).toBeUndefined()
        expect(mockT).toHaveBeenCalledWith(
            'transactions.warning.close_asset_warning',
            { address: 'TARGET' },
        )
    })

    it('emphasises the freeze warning for an asset freeze', () => {
        const { result } = renderHook(() =>
            useWarningItem({
                warning: { ...closeAccount, type: 'asset-freeze' },
                isGroup: false,
                scope: ALGO_SCOPE,
            }),
        )

        expect(result.current.icon).toBe('snowflake')
        expect(result.current.emphasis).toBe(
            'transactions.warning.asset_freeze_warning_bold',
        )
    })

    it('uses the group copy for a close-account warning in a group', () => {
        renderHook(() =>
            useWarningItem({
                warning: closeAccount,
                isGroup: true,
                scope: ALGO_SCOPE,
            }),
        )

        expect(mockT).toHaveBeenCalledWith(
            'transactions.warning.close_account_group_warning',
            { address: 'TARGET' },
        )
    })

    it('emphasises the rekey warning for a delegation', () => {
        const { result } = renderHook(() =>
            useWarningItem({
                warning: { ...closeAccount, type: 'delegation' },
                isGroup: false,
                scope: ALGO_SCOPE,
            }),
        )

        expect(result.current.emphasis).toBe(
            'transactions.warning.rekey_warning_bold',
        )
    })
})
