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

import { useCallback, useMemo, useState } from 'react'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { dappHostOf } from '../../utils/normalizeDappUrl'

// Larger icon first: favicon.ico is often 16px, and Android cannot decode it.
const SITE_ICON_PATHS = ['/apple-touch-icon.png', '/favicon.ico']

const siteIconsOf = (siteUrl: Optional<string>): string[] => {
    if (siteUrl === undefined || !/^https:\/\//i.test(siteUrl)) return []
    const host = dappHostOf(siteUrl)
    return SITE_ICON_PATHS.map(path => `https://${host}${path}`)
}

export type UseDappLogoParams = {
    logo: Nullable<string>
    siteUrl?: string
}

export type UseDappLogoResult = {
    /** The image to show; null means the globe. */
    uri: Nullable<string>
    /** Moves on to the next icon the site may serve, then to the globe. */
    handleError: () => void
}

export const useDappLogo = ({
    logo,
    siteUrl,
}: UseDappLogoParams): UseDappLogoResult => {
    const candidates = useMemo(
        () => (logo ? [logo] : siteIconsOf(siteUrl)),
        [logo, siteUrl],
    )
    // Keyed by the first candidate: a list cell recycled into another dApp
    // must not inherit the previous one's failures.
    const [failed, setFailed] = useState({ key: candidates[0], count: 0 })
    const failedCount = failed.key === candidates[0] ? failed.count : 0

    const handleError = useCallback(() => {
        setFailed({ key: candidates[0], count: failedCount + 1 })
    }, [candidates, failedCount])

    return { uri: candidates[failedCount] ?? null, handleError }
}
