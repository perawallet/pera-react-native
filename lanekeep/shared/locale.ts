/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import type { EmittedFact, ReduceLocation } from 'lanekeep'

export const EN_JSON = 'apps/mobile/src/i18n/locales/en.json'

/** A reduce finding on a key's own line in a locale JSON file, which lanekeep never discovers. */
// lanekeep's runtime rejects a reduce location without a column, whatever its type says.
export const jsonLocation = (fact: EmittedFact): ReduceLocation => ({
    file: String(fact.json),
    line: Number(fact.jsonLine),
    column: 1,
})

/** i18next plural suffixes. */
export const PLURAL_SUFFIXES: readonly string[] = [
    '_one',
    '_other',
    '_zero',
    '_two',
    '_few',
    '_many',
]

/** `items` for `items_one`, or undefined when the key has no plural suffix. */
export const pluralBase = (key: string): string | undefined => {
    const suffix = PLURAL_SUFFIXES.find(s => key.endsWith(s))
    return suffix === undefined ? undefined : key.slice(0, -suffix.length)
}

// A rule re-reads its file through ctx.readFile on every call, so the cache
// records the dependency; only the derived value is shared, keyed by the exact
// text. Length first, a cheap reject before the full comparison.
// Callers share the returned value; treat it as read-only.
const memo = <T>(compute: (raw: string) => T): ((raw: string) => T) => {
    const slots: { raw: string; value: T }[] = []
    return raw => {
        const hit = slots.find(
            s => s.raw.length === raw.length && s.raw === raw,
        )
        if (hit !== undefined) return hit.value
        const value = compute(raw)
        // Holds every locale read in one run; below the locale count, FIFO eviction turns every call into a miss.
        if (slots.length >= 8) slots.shift()
        slots.push({ raw, value })
        return value
    }
}

/** `JSON.parse`, once per distinct text. */
export const parseCached = memo((raw): unknown => JSON.parse(raw))

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
    walk(parseCached(raw), '')
    return out
}

/** A key naming an object is not renderable, so it fails like a missing one. */
export const isStringLeaf = (
    flat: Record<string, string>,
    key: string,
): boolean => typeof flat[key] === 'string'

/** Every leaf's dotted path whatever its value type. */
export const leafKeys = memo((raw): Set<string> => {
    const out = new Set<string>()
    const walk = (value: unknown, prefix: string): void => {
        if (typeof value === 'object' && value !== null) {
            for (const [key, child] of Object.entries(value)) {
                walk(child, prefix === '' ? key : `${prefix}.${key}`)
            }
            return
        }
        out.add(prefix)
    }
    walk(parseCached(raw), '')
    return out
})

/**
 * The 1-based line of every key path, objects and array elements included.
 * JSON.parse keeps no positions, so this walks the text itself; the input is
 * already known to parse.
 */
export const keyLines = memo((raw): Map<string, number> => {
    const out = new Map<string, number>()
    let i = 0
    let line = 1
    const skip = (): void => {
        while (i < raw.length && /\s/.test(raw.charAt(i))) {
            if (raw.charAt(i) === '\n') line++
            i++
        }
    }
    const readString = (): string => {
        const start = i
        i++
        while (i < raw.length && raw.charAt(i) !== '"')
            i += raw.charAt(i) === '\\' ? 2 : 1
        i++
        return JSON.parse(raw.slice(start, i)) as string
    }
    const readValue = (path: string): void => {
        skip()
        const ch = raw.charAt(i)
        if (ch === '{' || ch === '[') {
            const isObject = ch === '{'
            i++
            skip()
            if (raw.charAt(i) === (isObject ? '}' : ']')) {
                i++
                return
            }
            for (let index = 0; ; index++) {
                skip()
                let child = `${path}.${index}`
                if (isObject) {
                    const key = readString()
                    child = path === '' ? key : `${path}.${key}`
                    out.set(child, line)
                    skip()
                    i++ // ':'
                } else {
                    out.set(child, line)
                }
                readValue(child)
                skip()
                const next = raw.charAt(i)
                i++ // ',' or the closing bracket
                if (next !== ',') return
            }
        }
        if (ch === '"') {
            readString()
            return
        }
        while (i < raw.length && !/[,}\]\s]/.test(raw.charAt(i))) i++
    }
    readValue('')
    return out
})
