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
import {
    buildPrismUrl,
    type Maybe,
    type Optional,
} from '@perawallet/wallet-core-shared'

type UseCollectibleThumbnailParams = {
    thumbnailUrl: Maybe<string>
    /** Target width in physical pixels; when set, the CDN resizes via Prism query params. */
    imageWidth?: number
}

type UseCollectibleThumbnailResult = {
    imageUrl: Optional<string>
    showPlaceholder: boolean
    handleImageError: () => void
}

export const useCollectibleThumbnail = ({
    thumbnailUrl,
    imageWidth,
}: UseCollectibleThumbnailParams): UseCollectibleThumbnailResult => {
    const [hasLoadFailed, setHasLoadFailed] = useState(false)

    // FlashList recycles cells into new items, so a failure must not stick
    // to the component instance — only to the url that actually failed.
    useEffect(() => {
        setHasLoadFailed(false)
    }, [thumbnailUrl])

    const handleImageError = useCallback(() => {
        setHasLoadFailed(true)
    }, [])

    const imageUrl = imageWidth
        ? buildPrismUrl(thumbnailUrl, imageWidth)
        : (thumbnailUrl ?? undefined)

    return {
        imageUrl,
        showPlaceholder: !imageUrl || hasLoadFailed,
        handleImageError,
    }
}
