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
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useHiddenTokensStore } from '../../store/hiddenTokens'
import {
    changedHiddenTokenAddresses,
    useHiddenTokensInvalidation,
} from '../useHiddenTokensInvalidation'
import { MODULE_PREFIX } from '../querykeys'

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

describe('changedHiddenTokenAddresses', () => {
    it('names an address whose list gained an id', () => {
        expect(
            changedHiddenTokenAddresses(
                {},
                { 'ethereum/mainnet': { '0xa': ['0x1'] } },
            ),
        ).toEqual(['0xa'])
    })

    it('names an address whose last id was removed', () => {
        expect(
            changedHiddenTokenAddresses(
                { 'ethereum/mainnet': { '0xa': ['0x1'] } },
                {},
            ),
        ).toEqual(['0xa'])
    })

    it('leaves out an address whose lists are unchanged', () => {
        const same = { 'ethereum/mainnet': { '0xa': ['0x1'], '0xb': ['0x2'] } }

        expect(
            changedHiddenTokenAddresses(same, {
                'ethereum/mainnet': { '0xa': ['0x1'], '0xb': ['0x2', '0x3'] },
            }),
        ).toEqual(['0xb'])
    })

    it('notices a change under only one of an address’s scopes', () => {
        expect(
            changedHiddenTokenAddresses(
                { 'ethereum/mainnet': { '0xa': ['0x1'] } },
                {
                    'ethereum/mainnet': { '0xa': ['0x1'] },
                    'ethereum/base': { '0xa': ['0x1'] },
                },
            ),
        ).toEqual(['0xa'])
    })
})

describe('useHiddenTokensInvalidation', () => {
    beforeEach(() => {
        useHiddenTokensStore.getState().resetState()
    })

    it('invalidates only the account queries of the address that changed', async () => {
        const queryClient = new QueryClient()
        const key = (address: string) => [
            MODULE_PREFIX,
            'balance',
            { address, scope: SCOPE },
        ]
        queryClient.setQueryData(key('0xa'), 'a')
        queryClient.setQueryData(key('0xb'), 'b')
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            )
        renderHook(() => useHiddenTokensInvalidation(), { wrapper })

        await act(async () => {
            useHiddenTokensStore.getState().setTokenHidden({
                address: '0xa',
                scope: SCOPE,
                assetId: '0x1',
                isHidden: true,
            })
        })

        expect(queryClient.getQueryState(key('0xa'))?.isInvalidated).toBe(true)
        expect(queryClient.getQueryState(key('0xb'))?.isInvalidated).toBe(false)
    })
})
