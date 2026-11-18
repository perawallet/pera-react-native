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

import { useEffect, useRef } from 'react'
import { Image } from 'expo-image'

// Deferred past the commit: the native image views are torn down after it, and
// a clear that lands first finds their bitmaps still in use.
const clearMemoryCacheAfterCommit = () => {
    setTimeout(() => void Image.clearMemoryCache(), 0)
}

/**
 * Drops decoded bitmaps once an image-heavy surface goes off screen or unmounts
 * while shown; the surface must unmount its images first, since a mounted image
 * keeps its bitmap. React Native doesn't forward Android memory pressure to JS,
 * so without this they stay decoded for the whole foreground session.
 */
export const useImageMemoryReleaseOnHide = (isVisible: boolean): void => {
    const wasVisible = useRef(isVisible)

    useEffect(() => {
        if (wasVisible.current && !isVisible) clearMemoryCacheAfterCommit()
        wasVisible.current = isVisible
    }, [isVisible])

    useEffect(
        () => () => {
            if (wasVisible.current) clearMemoryCacheAfterCommit()
        },
        [],
    )
}
