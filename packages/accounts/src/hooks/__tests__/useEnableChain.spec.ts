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
import React from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { buildTestAccount, TEST_CUSTODY } from '../../__tests__/accountFactory'
import {
    BASE,
    ETHEREUM,
    EVM_KEY_ADDRESS,
    registerChainFamilies,
} from '../../__tests__/chainFamilies'
import { useAccountsStore } from '../../store'
import { useEnableChain } from '../useEnableChain'

const syncAndEnrichNewAccount = vi.hoisted(() => vi.fn(async () => {}))

vi.mock('../../sync/account-syncer', async importOriginal => ({
    ...(await importOriginal<typeof import('../../sync/account-syncer')>()),
    syncAndEnrichNewAccount,
}))

describe('useEnableChain', () => {
    const client = new QueryClient()
    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children)

    beforeEach(() => {
        registerChainFamilies()
        syncAndEnrichNewAccount.mockClear()
        useAccountsStore.getState().resetState()
        useAccountsStore
            .getState()
            .setAccounts([
                buildTestAccount(
                    TEST_CUSTODY.watch,
                    { [ETHEREUM]: { address: EVM_KEY_ADDRESS } },
                    { id: 'watch' },
                ),
            ])
    })

    test('enables the chain, leaving its sync to the root watcher', async () => {
        const { result } = renderHook(() => useEnableChain(), { wrapper })

        let account: Awaited<ReturnType<typeof result.current>> | undefined
        await act(async () => {
            account = await result.current('watch', BASE, 'user')
        })

        expect(account?.chains[BASE]?.enabledBy).toBe('user')
        expect(syncAndEnrichNewAccount).not.toHaveBeenCalled()
    })
})
