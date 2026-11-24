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

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useHiddenTokensStore } from '../store/hiddenTokens'
import { useKeptTokensStore } from '../store/keptTokens'
import type { TokenSets } from '../store/tokenSets'
import { invalidateAccountQueriesForAddresses } from './querykeys'

const addressesOf = (hiddenTokens: TokenSets): Set<string> =>
    new Set(
        Object.values(hiddenTokens).flatMap(byAddress =>
            Object.keys(byAddress),
        ),
    )

const listsOf = (
    hiddenTokens: TokenSets,
    address: string,
): Record<string, string> =>
    Object.fromEntries(
        Object.entries(hiddenTokens).map(([scopeKey, byAddress]) => [
            scopeKey,
            (byAddress[address] ?? []).join(','),
        ]),
    )

/** Addresses whose hidden ids differ under any scope. */
export const changedHiddenTokenAddresses = (
    previous: TokenSets,
    next: TokenSets,
): string[] =>
    [...new Set([...addressesOf(previous), ...addressesOf(next)])].filter(
        address => {
            const before = listsOf(previous, address)
            const after = listsOf(next, address)
            return [
                ...new Set([...Object.keys(before), ...Object.keys(after)]),
            ].some(
                scopeKey =>
                    (before[scopeKey] ?? '') !== (after[scopeKey] ?? ''),
            )
        },
    )

/**
 * The holdings reads and totals are cached and read the hidden and kept sets
 * when they run, so a change to either, from this device or from a backup
 * import, has to reach them.
 */
export const useHiddenTokensInvalidation = (): void => {
    const queryClient = useQueryClient()
    useEffect(() => {
        const invalidate = (previous: TokenSets, next: TokenSets) =>
            invalidateAccountQueriesForAddresses(
                queryClient,
                changedHiddenTokenAddresses(previous, next),
                { includeMultiAccountKeys: true },
            )
        const unsubscribeHidden = useHiddenTokensStore.subscribe(
            (state, previous) =>
                invalidate(previous.hiddenTokens, state.hiddenTokens),
        )
        const unsubscribeKept = useKeptTokensStore.subscribe(
            (state, previous) =>
                invalidate(previous.keptTokens, state.keptTokens),
        )
        return () => {
            unsubscribeHidden()
            unsubscribeKept()
        }
    }, [queryClient])
}
