/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react'
import type { Collection } from './collection'

type DependencyList = ReadonlyArray<unknown>

/**
 * Subscribe a React component to a derived value of a `Collection`.
 *
 * `compute` runs every time the collection changes or `deps` changes. Its
 * result is cached by user-supplied `isEqual` (default: `Object.is`) so
 * components re-render only when the derived value actually changes.
 *
 * ```ts
 * const row = useCollectionQuery(
 *     nfdCacheCollection,
 *     c => c.get(`${network}:${address}`),
 *     [network, address],
 * )
 * ```
 *
 * The shape (collection + compute + deps) mirrors what a TanStack DB
 * `useLiveQuery` call looks like for single-result reads, so once we
 * upgrade to the real upstream library the call sites keep working with
 * minimal edits.
 */
export function useCollectionQuery<TValue, TResult>(
    collection: Collection<TValue>,
    compute: (collection: Collection<TValue>) => TResult,
    deps: DependencyList,
    isEqual: (a: TResult, b: TResult) => boolean = Object.is,
): TResult {
    // We combine three signals into one "version" used by useSyncExternalStore:
    //
    //   (1) a monotonically-increasing counter that bumps whenever the
    //       collection notifies subscribers;
    //   (2) the identity of the `deps` array (so prop changes re-run
    //       `compute` even though the collection hasn't changed);
    //   (3) the identity of the collection itself.
    //
    // `getSnapshot` must be stable between subscribes, so we memoize its
    // return value until any of those signals advances.
    const tickRef = useRef(0)
    const lastDepsRef = useRef<DependencyList | null>(null)
    const lastResultRef = useRef<{ value: TResult } | null>(null)
    const lastTickRef = useRef(-1)

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const depsKey = useMemo(() => deps, deps)

    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            return collection.subscribe(() => {
                tickRef.current += 1
                onStoreChange()
            })
        },
        [collection],
    )

    const getSnapshot = useCallback((): TResult => {
        const tick = tickRef.current
        const depsChanged = lastDepsRef.current !== depsKey
        if (
            !depsChanged &&
            lastTickRef.current === tick &&
            lastResultRef.current !== null
        ) {
            return lastResultRef.current.value
        }
        const next = compute(collection)
        if (
            lastResultRef.current !== null &&
            isEqual(lastResultRef.current.value, next)
        ) {
            lastTickRef.current = tick
            lastDepsRef.current = depsKey
            return lastResultRef.current.value
        }
        lastResultRef.current = { value: next }
        lastTickRef.current = tick
        lastDepsRef.current = depsKey
        return next
        // `compute` and `isEqual` are intentionally not in the deps list:
        // they are expected to be pure-ish closures and the result cache
        // already handles staleness via `depsKey` + collection tick.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [collection, depsKey])

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
