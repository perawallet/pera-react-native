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

import { useCallback, useEffect, useState } from 'react'

// ponytail: a fixed page budget; read it from remote config like the type
// filter's scan pages if spam-heavy histories need a different one.
const HIDDEN_SCAN_PAGES = 4

export type UseWalkPastHiddenRowsParams = {
    /** Rows were read, and the suspicious filter hides every one of them. */
    isAllHidden: boolean
    hasNextPage: boolean
    isFetchingNextPage: boolean
    /** Rows read so far, hidden ones included; a change means a page landed. */
    loadedCount: number
    loadMore: () => void
}

export type UseWalkPastHiddenRowsResult = {
    /** The budget ran out with nothing to show; Search Older resumes. */
    isPaused: boolean
    resume: () => void
}

/**
 * Reads on while the suspicious filter hides every row read so far: an empty
 * list never reaches its end, so nothing else would ask for the next page, and
 * a history that opens on a page of spam would load forever. Stops after a few
 * pages so an all-spam history isn't walked request by request.
 */
export const useWalkPastHiddenRows = ({
    isAllHidden,
    hasNextPage,
    isFetchingNextPage,
    loadedCount,
    loadMore,
}: UseWalkPastHiddenRowsParams): UseWalkPastHiddenRowsResult => {
    const [walk, setWalk] = useState({ pages: 0, requestedAt: -1 })

    useEffect(() => {
        if (!isAllHidden) {
            setWalk(current =>
                current.pages === 0 ? current : { pages: 0, requestedAt: -1 },
            )
            return
        }
        if (
            !hasNextPage ||
            isFetchingNextPage ||
            walk.requestedAt === loadedCount ||
            walk.pages >= HIDDEN_SCAN_PAGES
        ) {
            return
        }
        setWalk({ pages: walk.pages + 1, requestedAt: loadedCount })
        loadMore()
    }, [
        isAllHidden,
        hasNextPage,
        isFetchingNextPage,
        loadedCount,
        loadMore,
        walk,
    ])

    const resume = useCallback(() => {
        setWalk({ pages: 0, requestedAt: -1 })
    }, [])

    return {
        isPaused:
            isAllHidden &&
            hasNextPage &&
            !isFetchingNextPage &&
            walk.pages >= HIDDEN_SCAN_PAGES,
        resume,
    }
}
