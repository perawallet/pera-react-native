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

import type { UseMutationResult } from '@tanstack/react-query'
import type { Nullable } from '@perawallet/wallet-core-shared'

/**
 * Stable, dependency-free shape every card mutation hook returns — so callers
 * never see TanStack's `UseMutationResult` (per the package hook conventions).
 */
export type CardMutationResult<TVars, TData = void> = {
    mutate: (variables: TVars) => void
    mutateAsync: (variables: TVars) => Promise<TData>
    isPending: boolean
    isError: boolean
    isSuccess: boolean
    /** True while the mutation is paused by the network mode. Under the app's
     *  fail-fast policy (`networkMode: 'always'`) this stays false — offline
     *  failures reject instead — but the flag is part of the surface contract
     *  so gating never needs a type change. */
    isPaused: boolean
    error: Nullable<Error>
    data: Nullable<TData>
    reset: () => void
}

/** Maps a raw TanStack mutation result to {@link CardMutationResult}. */
export const toCardMutationResult = <TVars, TData>(
    mutation: UseMutationResult<TData, Error, TVars>,
): CardMutationResult<TVars, TData> => ({
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    isPaused: mutation.isPaused,
    error: mutation.error,
    data: mutation.data ?? null,
    reset: mutation.reset,
})
