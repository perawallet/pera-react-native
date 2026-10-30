/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

export interface PnpmLock {
    /** Catalog entry to the version `catalogs.default` resolved it to. */
    catalog: Map<string, string>
    /**
     * `name@version` (peer suffix stripped) to one dependency map per snapshot
     * of it: a release resolved under several peer sets has several.
     */
    snapshots: Map<string, Map<string, string>[]>
}

const indentOf = (line: string): number => line.length - line.trimStart().length

const stripPeers = (value: string): string => {
    const peers = value.indexOf('(')
    return peers === -1 ? value : value.slice(0, peers)
}

const unquote = (raw: string): string => {
    const quote = raw.charAt(0)
    if (quote === "'" || quote === '"') {
        const end = raw.lastIndexOf(quote)
        return end > 0 ? raw.slice(1, end) : raw.slice(1)
    }
    return raw
}

/** `key: value` or `key:` where the key may be quoted. */
const parseLine = (
    trimmed: string,
): { key: string; value: string } | undefined => {
    const quote = trimmed.charAt(0)
    if (quote === "'" || quote === '"') {
        const end = trimmed.indexOf(quote, 1)
        if (end === -1 || trimmed.charAt(end + 1) !== ':') return undefined
        return {
            key: trimmed.slice(1, end),
            value: trimmed.slice(end + 2).trim(),
        }
    }
    const colon = trimmed.indexOf(': ')
    if (colon !== -1) {
        return {
            key: trimmed.slice(0, colon),
            value: trimmed.slice(colon + 2).trim(),
        }
    }
    if (trimmed.endsWith(':')) {
        return { key: trimmed.slice(0, -1), value: '' }
    }
    return undefined
}

/**
 * Reads the two lockfile v9 sections the catalog pins are checked against:
 * `catalogs.default` and the `dependencies` of each `snapshots` entry.
 */
export const parsePnpmLock = (raw: string): PnpmLock => {
    const catalog = new Map<string, string>()
    const snapshots = new Map<string, Map<string, string>[]>()
    let section = ''
    let inDefaultCatalog = false
    let catalogName = ''
    let snapshot: Map<string, string> | undefined
    let inDependencies = false
    for (const text of raw.split('\n')) {
        const trimmed = text.trim()
        if (trimmed === '' || trimmed.startsWith('#')) continue
        const indent = indentOf(text)
        if (indent === 0) {
            section = parseLine(trimmed)?.key ?? ''
            inDefaultCatalog = false
            snapshot = undefined
            inDependencies = false
            continue
        }
        const line = parseLine(trimmed)
        if (line === undefined) continue
        if (section === 'catalogs') {
            if (indent === 2) {
                inDefaultCatalog = line.key === 'default'
            } else if (inDefaultCatalog && indent === 4) {
                catalogName = line.key
            } else if (
                inDefaultCatalog &&
                indent === 6 &&
                line.key === 'version'
            ) {
                catalog.set(catalogName, stripPeers(unquote(line.value)))
            }
        } else if (section === 'snapshots') {
            if (indent === 2) {
                const key = stripPeers(line.key)
                const at = key.indexOf('@', 1)
                if (at === -1) {
                    snapshot = undefined
                } else {
                    snapshot = new Map()
                    const list = snapshots.get(key) ?? []
                    list.push(snapshot)
                    snapshots.set(key, list)
                }
                inDependencies = false
            } else if (indent === 4) {
                inDependencies = line.key === 'dependencies'
            } else if (indent === 6 && inDependencies && snapshot) {
                snapshot.set(line.key, stripPeers(unquote(line.value)))
            }
        }
    }
    return { catalog, snapshots }
}

const SEMVER =
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

const comparePrerelease = (a: string, b: string): -1 | 0 | 1 => {
    const left = a.split('.')
    const right = b.split('.')
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
        const x = left[i]
        const y = right[i]
        if (x === undefined) return -1
        if (y === undefined) return 1
        const xNumeric = /^\d+$/.test(x)
        const yNumeric = /^\d+$/.test(y)
        if (xNumeric && yNumeric) {
            const diff = Number(x) - Number(y)
            if (diff !== 0) return diff < 0 ? -1 : 1
        } else if (xNumeric !== yNumeric) {
            return xNumeric ? -1 : 1
        } else if (x !== y) {
            return x < y ? -1 : 1
        }
    }
    return 0
}

/** Semver precedence, or `undefined` when either side isn't a plain version. */
export const compareVersions = (
    a: string,
    b: string,
): -1 | 0 | 1 | undefined => {
    const left = SEMVER.exec(a)
    const right = SEMVER.exec(b)
    if (left === null || right === null) return undefined
    for (let i = 1; i <= 3; i++) {
        const diff = Number(left[i]) - Number(right[i])
        if (diff !== 0) return diff < 0 ? -1 : 1
    }
    const x = left[4]
    const y = right[4]
    if (x === undefined && y === undefined) return 0
    if (x === undefined) return 1
    if (y === undefined) return -1
    return comparePrerelease(x, y)
}
