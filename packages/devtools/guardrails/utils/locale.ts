import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const EN_JSON = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../../apps/mobile/src/i18n/locales/en.json',
)

function flatten(
    value: unknown,
    prefix: string,
    out: Record<string, string>,
): void {
    if (typeof value === 'string') {
        out[prefix] = value
        return
    }
    if (typeof value !== 'object' || value === null) return
    for (const [key, child] of Object.entries(value)) {
        flatten(child, prefix ? `${prefix}.${key}` : key, out)
    }
}

let cached: Record<string, string> | undefined

/** Flattened en.json, dotted keys → string leaves. Objects are not included. */
export function loadEnFlat(): Record<string, string> {
    if (cached === undefined) {
        const out: Record<string, string> = {}
        flatten(JSON.parse(readFileSync(EN_JSON, 'utf8')), '', out)
        cached = out
    }
    return cached
}

export function isStringLeaf(
    flat: Record<string, string>,
    key: string,
): boolean {
    return typeof flat[key] === 'string'
}
