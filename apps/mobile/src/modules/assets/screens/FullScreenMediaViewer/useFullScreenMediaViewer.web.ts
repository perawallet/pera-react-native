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

import { useCallback, useEffect, useRef, useState } from 'react'
import { openValidatedBrowserUrl } from '@modules/webview'
import type { FullScreenMediaItem } from './FullScreenMediaViewer'

export type UseFullScreenMediaViewerResult = {
    activeIndex: number
    activeItem: FullScreenMediaItem | undefined
    hasPrevious: boolean
    hasNext: boolean
    handlePrevious: () => void
    handleNext: () => void
    handleOpenOriginal: () => void
}

export const useFullScreenMediaViewer = (
    media: FullScreenMediaItem[],
    initialIndex = 0,
): UseFullScreenMediaViewerResult => {
    const lastIndex = media.length - 1
    const [activeIndex, setActiveIndex] = useState(() =>
        Math.min(Math.max(initialIndex, 0), Math.max(lastIndex, 0)),
    )
    const activeItem = media[activeIndex]
    const hasPrevious = activeIndex > 0
    const hasNext = activeIndex < lastIndex

    const handlePrevious = useCallback(() => {
        setActiveIndex(index => Math.max(index - 1, 0))
    }, [])

    const handleNext = useCallback(() => {
        setActiveIndex(index => Math.min(index + 1, Math.max(lastIndex, 0)))
    }, [lastIndex])

    const handleOpenOriginal = useCallback(() => {
        if (activeItem) openValidatedBrowserUrl(activeItem.uri)
    }, [activeItem])

    const latest = useRef({ handlePrevious, handleNext })
    latest.current = { handlePrevious, handleNext }

    useEffect(() => {
        if (lastIndex < 1) return
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'ArrowLeft') latest.current.handlePrevious()
            else if (event.key === 'ArrowRight') latest.current.handleNext()
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [lastIndex])

    return {
        activeIndex,
        activeItem,
        hasPrevious,
        hasNext,
        handlePrevious,
        handleNext,
        handleOpenOriginal,
    }
}
