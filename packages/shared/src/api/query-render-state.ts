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

/**
 * The subset of a TanStack Query (or Infinite Query) result this helper reads.
 * Both `useQuery` and `useInfiniteQuery` results are structurally assignable to
 * this shape, so callers can pass their raw query result directly.
 */
export type QueryLike<TData, TError = Error> = {
    data: TData | undefined
    error: TError | null
    status: 'pending' | 'error' | 'success'
    fetchStatus: 'fetching' | 'paused' | 'idle'
}

/**
 * Normalised render state for a data-backed query. This is the paused-aware UI
 * contract that offline-resilience surface tickets consume: exactly one of
 * `isError` / `isPaused` / `isFetching` / `isPending` describes what to render,
 * with `data` carrying whatever (possibly cached/stale) rows are available.
 *
 * Precedence (highest first): `isError` → `isPaused` → `isFetching` → `isPending`.
 * See docs/OFFLINE_PAUSED_STATE.md for the full UI contract.
 */
export type QueryRenderState<TData, TError = Error> = {
    /** Resolved rows, if any. May be cached/stale data served while paused. */
    data: TData | undefined
    /** The query error, if any — pair with a retry affordance. */
    error: TError | null
    /** Query failed: render an error state with retry. */
    isError: boolean
    /** Paused because the app is offline: render the offline/cached surface, not a spinner. */
    isPaused: boolean
    /** A fetch is in flight: render a spinner (or a background refresh indicator when `data` exists). */
    isFetching: boolean
    /** Cold idle load with no data yet: render the initial skeleton. */
    isPending: boolean
}

/**
 * Map a query result to the paused-aware {@link QueryRenderState} contract.
 *
 * `isPending` is deliberately narrower than TanStack's own `isPending`: it is
 * true only for a genuine cold load (`status === 'pending'` AND `fetchStatus
 * === 'idle'`). When a query is `pending` because it is `paused` (offline, no
 * cache), `isPaused` — not `isPending` — is raised, so consumers render the
 * offline surface instead of an eternal skeleton.
 */
export const getQueryRenderState = <TData, TError = Error>(
    query: QueryLike<TData, TError>,
): QueryRenderState<TData, TError> => ({
    data: query.data,
    error: query.error,
    isError: query.status === 'error',
    isPaused: query.fetchStatus === 'paused',
    isFetching: query.fetchStatus === 'fetching',
    isPending: query.status === 'pending' && query.fetchStatus === 'idle',
})
