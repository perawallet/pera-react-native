/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

export const EN_JSON = 'apps/mobile/src/i18n/locales/en.json'

/** Dotted keys to string leaves. Objects are deliberately not included. */
export function flattenLocale(raw: string): Record<string, string> {
    const out: Record<string, string> = {}
    const walk = (value: unknown, prefix: string): void => {
        if (typeof value === 'string') {
            out[prefix] = value
            return
        }
        if (typeof value !== 'object' || value === null) return
        for (const [key, child] of Object.entries(value)) {
            walk(child, prefix === '' ? key : `${prefix}.${key}`)
        }
    }
    walk(JSON.parse(raw), '')
    return out
}

/** A key naming an object is not renderable, so it fails like a missing one. */
export const isStringLeaf = (
    flat: Record<string, string>,
    key: string,
): boolean => typeof flat[key] === 'string'
