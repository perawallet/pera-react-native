/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

// Rules run inside lanekeep's own runtime, so no node:path.
/** `specifier` resolved against the directory of `fromFile`; both repo-relative. */
export const resolveRelative = (
    fromFile: string,
    specifier: string,
): string => {
    const parts = fromFile.split('/').slice(0, -1)
    for (const segment of specifier.split('/')) {
        if (segment === '..') parts.pop()
        else if (segment !== '.') parts.push(segment)
    }
    return parts.join('/')
}
