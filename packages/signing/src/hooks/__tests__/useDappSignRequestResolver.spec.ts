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

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { registerFakePlannerAdapter } from '../../__tests__/fakePlannerAdapter'
import { algo25Account, multisigAccount } from '../../__tests__/accounts'
import type { DappResolveResult } from '../../chain-adapter'
import { useDappSignRequestResolver } from '../useDappSignRequestResolver'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

const mockAccounts = vi.fn<() => WalletAccount[]>()

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useSigningAccounts: () => mockAccounts(),
    useAllAccounts: () => mockAccounts(),
}))

const resolved: DappResolveResult = { payload: { toSign: [] } }

describe('useDappSignRequestResolver', () => {
    const resolve = vi.fn(() => resolved)

    beforeEach(() => {
        mockAccounts.mockReturnValue([
            algo25Account('A'),
            multisigAccount('MSIG1'),
        ])
        resolve.mockClear()
        registerFakePlannerAdapter({ resolveDappRequest: resolve })
    })

    it('binds the wallet signing and multisig addresses into the planner call', () => {
        const { result } = renderHook(() => useDappSignRequestResolver(SCOPE))
        const request = { payload: { transactions: [{ txn: 'abc' }] } }

        const outcome = result.current(request)

        expect(outcome).toBe(resolved)
        expect(resolve).toHaveBeenCalledWith(request, {
            signableAddresses: new Set(['A', 'MSIG1']),
            multisigAddresses: new Set(['MSIG1']),
            authorizedAddresses: undefined,
            maxTransactions: undefined,
        })
    })

    it('passes authorizedAddresses and maxTransactions through', () => {
        const { result } = renderHook(() => useDappSignRequestResolver(SCOPE))
        const authorizedAddresses = new Set(['A'])

        result.current(
            { payload: { transactions: [] } },
            { authorizedAddresses, maxTransactions: 2 },
        )

        expect(resolve).toHaveBeenCalledWith(
            { payload: { transactions: [] } },
            expect.objectContaining({
                authorizedAddresses,
                maxTransactions: 2,
            }),
        )
    })
})
