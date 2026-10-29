/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

// Rules run inside lanekeep's own runtime, so no YAML library: this reads the
// block style pnpm-workspace.yaml and the workflows here are written in.

/** Strips one level of `'`/`"` quoting, or drops a trailing ` #` comment from a plain scalar. */
export const unquote = (raw: string): string => {
    const value = raw.trim()
    const quote = value.charAt(0)
    if (quote === "'" || quote === '"') {
        const end = value.indexOf(quote, 1)
        return end === -1 ? value.slice(1) : value.slice(1, end)
    }
    const comment = value.indexOf(' #')
    return (comment === -1 ? value : value.slice(0, comment)).trim()
}

const indentOf = (line: string): number => line.length - line.trimStart().length

// Plain keys may hold spaces, `@`, `<` and `>` (`esbuild@>=0.27.3 <0.28.1`), so
// a plain key ends at the first colon followed by whitespace or the line end.
const splitEntry = (
    text: string,
): { key: string; rest: string } | undefined => {
    const quote = text.charAt(0)
    if (quote === "'" || quote === '"') {
        const end = text.indexOf(quote, 1)
        if (end === -1 || text.charAt(end + 1) !== ':') return undefined
        return { key: text.slice(1, end), rest: text.slice(end + 2) }
    }
    const colon = /:(\s|$)/.exec(text)
    if (colon === null) return undefined
    return {
        key: text.slice(0, colon.index),
        rest: text.slice(colon.index + 1),
    }
}

/**
 * The scalar entries of the block mapping under the column-0 line `key:`, with
 * 1-based lines. Nested mappings and entries with an empty value are skipped,
 * so a flow mapping or a sequence reads as empty rather than as wrong values.
 */
export const topLevelMapping = (
    raw: string,
    key: string,
): Map<string, { value: string; line: number }> => {
    const out = new Map<string, { value: string; line: number }>()
    const lines = raw.split('\n')
    let inBlock = false
    let entryIndent = -1
    for (let i = 0; i < lines.length; i++) {
        const text = (lines[i] ?? '').replace(/\r$/, '')
        const trimmed = text.trim()
        if (trimmed === '' || trimmed.startsWith('#')) continue
        const indent = indentOf(text)
        if (indent === 0) {
            if (inBlock) return out
            const head = splitEntry(trimmed)
            const rest = head?.rest.trim() ?? ''
            inBlock =
                head !== undefined &&
                unquote(head.key) === key &&
                (rest === '' || rest.startsWith('#'))
            continue
        }
        if (!inBlock) continue
        if (entryIndent === -1) entryIndent = indent
        if (indent !== entryIndent) continue
        const entry = splitEntry(trimmed)
        if (entry === undefined) continue
        const value = entry.rest.trim().startsWith('#')
            ? ''
            : unquote(entry.rest)
        if (value === '') continue
        out.set(unquote(entry.key), { value, line: i + 1 })
    }
    return out
}
