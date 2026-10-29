/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

export const dirOf = (path: string): string =>
    path.split('/').slice(0, -1).join('/')

export const join = (base: string, path: string): string =>
    base === '' ? path : `${base}/${path}`

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

/**
 * The block-sequence entries under a nested mapping key, and the line of that
 * key (1-based, 0 when absent). Handles the block style every workflow and
 * pnpm-workspace.yaml here is written in; a flow sequence (`[a, b]`) reads as
 * empty, which reports every path as missing rather than passing silently.
 */
export const yamlList = (
    raw: string,
    keyPath: readonly string[],
): { items: string[]; line: number } => {
    const stack: { indent: number; key: string }[] = []
    const items: string[] = []
    let line = 0
    const lines = raw.split('\n')
    for (let i = 0; i < lines.length; i++) {
        const text = lines[i] ?? ''
        const trimmed = text.trim()
        if (trimmed === '' || trimmed.startsWith('#')) continue
        const indent = indentOf(text)
        const item = /^-\s+(.*)$/.exec(trimmed)
        if (item !== null) {
            const inside =
                stack.length === keyPath.length &&
                stack.every((s, k) => s.key === keyPath[k]) &&
                indent >= (stack[stack.length - 1]?.indent ?? 0)
            if (inside) items.push(unquote(item[1] ?? ''))
            continue
        }
        const key = /^([^\s:#][^:#]*?):(\s|$)/.exec(trimmed)
        if (key === null) continue
        while (
            stack.length > 0 &&
            (stack[stack.length - 1]?.indent ?? 0) >= indent
        ) {
            stack.pop()
        }
        stack.push({ indent, key: unquote(key[1] ?? '') })
        if (
            stack.length === keyPath.length &&
            stack.every((s, k) => s.key === keyPath[k])
        ) {
            line = i + 1
        }
    }
    return { items, line }
}

export interface YamlComment {
    text: string
    line: number
}

export interface YamlMapEntry {
    key: string
    value: string
    line: number
    comments: YamlComment[]
}

const QUOTED_KEY = /^(["'])(.*?)\1\s*:(?:\s+(.*))?$/
const PLAIN_KEY = /^([^\s"'#-].*?):(?:\s+(.*))?$/

const parseKey = (
    trimmed: string,
): { key: string; value: string } | undefined => {
    const quoted = QUOTED_KEY.exec(trimmed)
    if (quoted !== null) {
        return { key: quoted[2] ?? '', value: unquote(quoted[3] ?? '') }
    }
    if (trimmed.startsWith('-')) return undefined
    // The key runs up to the first `: `, so `esbuild@>=0.27.3 <0.28.1` parses.
    const plain = PLAIN_KEY.exec(trimmed)
    if (plain === null) return undefined
    return { key: (plain[1] ?? '').trim(), value: unquote(plain[2] ?? '') }
}

/**
 * The direct children of the top-level block mapping `key:`, in file order,
 * each with the comment run directly above it. A blank line clears the
 * pending comments, so a header comment separated by one belongs to no entry.
 */
export const yamlMap = (raw: string, key: string): YamlMapEntry[] => {
    const lines = raw.split('\n')
    const out: YamlMapEntry[] = []
    let inside = false
    let childIndent = -1
    let pending: YamlComment[] = []
    for (let i = 0; i < lines.length; i++) {
        const text = lines[i] ?? ''
        const trimmed = text.trim()
        const indent = indentOf(text)
        if (!inside) {
            if (indent === 0 && trimmed === `${key}:`) inside = true
            continue
        }
        if (trimmed === '') {
            pending = []
            continue
        }
        if (trimmed.startsWith('#')) {
            pending.push({ text: trimmed.slice(1).trim(), line: i + 1 })
            continue
        }
        if (indent === 0) break
        if (childIndent === -1) childIndent = indent
        if (indent !== childIndent) {
            pending = []
            continue
        }
        const entry = parseKey(trimmed)
        if (entry !== undefined) {
            out.push({
                key: entry.key,
                value: entry.value,
                line: i + 1,
                comments: pending,
            })
        }
        pending = []
    }
    return out
}

export interface ReadCtx {
    readFile(path: string): string | undefined
    listDir(path: string): string[] | undefined
}

const nameOf = (ctx: ReadCtx, dir: string): string | undefined => {
    const raw = ctx.readFile(`${dir}/package.json`)
    if (raw === undefined) return undefined
    try {
        const name = (JSON.parse(raw) as { name?: unknown }).name
        return typeof name === 'string' ? name : undefined
    } catch {
        return undefined
    }
}

/**
 * The `packages:` directories of pnpm-workspace.yaml, relative to `base`.
 * Only `<dir>/*` and literal patterns are read; some may hold no package.json.
 */
export const workspaceMembers = (ctx: ReadCtx, base: string): string[] => {
    const raw = ctx.readFile(join(base, 'pnpm-workspace.yaml'))
    if (raw === undefined) return []
    const dirs: string[] = []
    for (const pattern of yamlList(raw, ['packages']).items) {
        if (pattern.endsWith('/*')) {
            const parent = pattern.slice(0, -2)
            // listDir marks a directory with a trailing slash.
            for (const entry of ctx.listDir(join(base, parent)) ?? []) {
                if (entry.endsWith('/'))
                    dirs.push(`${parent}/${entry.slice(0, -1)}`)
            }
        } else {
            dirs.push(pattern)
        }
    }
    return dirs
}

/** Workspace package name to its directory, relative to the project root. */
export const workspaceDirs = (
    ctx: ReadCtx,
    base: string,
): Map<string, string> => {
    const out = new Map<string, string>()
    for (const dir of workspaceMembers(ctx, base)) {
        const name = nameOf(ctx, join(base, dir))
        if (name !== undefined) out.set(name, dir)
    }
    return out
}
