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

import { useRef } from 'react'

const isSameList = (a: string[], b: string[]): boolean => {
    if (a === b) return true
    if (a.length !== b.length) return false
    for (let index = 0; index < a.length; index++) {
        if (a[index] !== b[index]) return false
    }
    return true
}

/**
 * Holds a list of ids at a stable reference until its contents actually
 * change, so a caller that rebuilds the array every render doesn't churn
 * whatever is keyed on it — a query cache entry, a `useMemo`, an effect.
 *
 * Compares element-wise rather than by joining into a key string: the list can
 * run to tens of thousands of entries, where building a join string every
 * render allocated hundreds of kilobytes per keystroke (PERA-4861). The
 * comparison short-circuits on reference equality, so a caller that already
 * memoises its array pays nothing.
 */
export const useStableIdList = (ids: string[]): string[] => {
    const idsRef = useRef(ids)

    if (!isSameList(idsRef.current, ids)) {
        idsRef.current = ids
    }

    return idsRef.current
}
