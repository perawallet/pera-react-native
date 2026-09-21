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

import { DEFAULT_PRISM_IMAGE_QUALITY } from '../models/constants'
import type { Maybe, Optional } from './types'

export const stripUrlScheme = (url?: string) => {
    if (!url) {
        return url
    }

    const index = url.indexOf('//')

    if (index >= 0) {
        return url.substring(index + 2)
    }
    return url
}

/** The URL's origin, or undefined when it doesn't parse to a real one. */
export const originOf = (url?: string): Optional<string> => {
    if (!url) return undefined
    try {
        const { origin } = new URL(url)
        // Opaque origins (extension, data, file URLs) serialise as 'null',
        // which would make any two of them compare equal.
        return origin === 'null' ? undefined : origin
    } catch {
        return undefined
    }
}

/** An unparseable or opaque side is never the same origin. */
export const isSameOrigin = (a?: string, b?: string): boolean => {
    const origin = originOf(a)
    return !!origin && origin === originOf(b)
}

export const buildPrismUrl = (
    url: Maybe<string>,
    width: number,
    quality: number = DEFAULT_PRISM_IMAGE_QUALITY,
): Optional<string> => {
    if (!url) {
        return undefined
    }

    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}width=${Math.round(width)}&quality=${quality}`
}
