/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { compareVersions, parsePnpmLock } from '../shared/pnpm-lock.js'
import type { PnpmLock } from '../shared/pnpm-lock.js'
import { dirOf, join } from '../shared/workspace.js'

interface MajorSplit {
    majors: readonly number[]
    reason: string
}

// A second copy is a second implementation in the bundle to audit. The 1.x
// line cannot collapse into 2.x: 2.x is a breaking major (ESM `.js` subpaths,
// dropped modules).
const NOBLE_MAJOR_SPLIT: MajorSplit = {
    majors: [1, 2],
    reason:
        'viem 2, ox 0.14, @walletconnect/utils, @walletconnect/relay-auth and ' +
        '@algorandfoundation/dp256 pin the 1.x API exactly and 2.x is a breaking ' +
        'major, while the keystore, xhd-wallet-api and the @scure 2.x line need 2.x',
}

// `undefined` means exactly one version.
const SINGLE_COPY_PACKAGES: ReadonlyMap<string, MajorSplit | undefined> =
    new Map([
        ['@noble/curves', NOBLE_MAJOR_SPLIT],
        ['@noble/hashes', NOBLE_MAJOR_SPLIT],
        ['ox', undefined],
    ])

const LOCKFILE = 'pnpm-lock.yaml'

interface Finding {
    file: string
    line: number
    message: string
}

const versionOf = (key: string): string => key.slice(key.indexOf('@', 1) + 1)

const copiesOf = (lock: PnpmLock, name: string): string[] => {
    const versions = new Set<string>()
    for (const key of lock.snapshots.keys()) {
        const at = key.indexOf('@', 1)
        if (at !== -1 && key.slice(0, at) === name) versions.add(versionOf(key))
    }
    return [...versions].sort((a, b) => compareVersions(a, b) ?? 1)
}

const dependentsOf = (
    lock: PnpmLock,
    name: string,
    version: string,
): string[] => {
    const found = new Set<string>()
    for (const [key, variants] of lock.snapshots) {
        if (variants.some(deps => deps.get(name) === version)) found.add(key)
    }
    return [...found].sort()
}

const describeCopy = (
    lock: PnpmLock,
    name: string,
    version: string,
): string => {
    const dependents = dependentsOf(lock, name, version)
    return dependents.length === 0
        ? `${version} (from a workspace package)`
        : `${version} (from ${dependents.join(', ')})`
}

const majorOf = (version: string): number | undefined => {
    const major = /^(\d+)\./.exec(version)?.[1]
    return major === undefined ? undefined : Number(major)
}

const lineOf = (lock: PnpmLock, name: string, version: string): number =>
    lock.snapshotLines.get(`${name}@${version}`) ?? 1

const COLLAPSE =
    'collapse them with an override in pnpm-workspace.yaml, or add a split with its reason to SINGLE_COPY_PACKAGES'

const checkPackage = (
    lock: PnpmLock,
    name: string,
    split: MajorSplit | undefined,
    lockPath: string,
    found: Finding[],
): void => {
    const at = (line: number, message: string): void => {
        found.push({ file: lockPath, line, message })
    }
    const copies = copiesOf(lock, name)
    const [first] = copies
    if (first === undefined) {
        at(
            1,
            `'${name}' is not in ${LOCKFILE}; drop it from SINGLE_COPY_PACKAGES`,
        )
        return
    }
    if (split === undefined) {
        if (copies.length > 1) {
            const listed = copies.map(v => describeCopy(lock, name, v))
            at(
                lineOf(lock, name, first),
                `'${name}' resolves to ${copies.length} versions: ${listed.join(', ')}; ${COLLAPSE}`,
            )
        }
        return
    }
    const allowed = split.majors.map(m => `${m}.x`).join(' and ')
    for (const version of copies) {
        const major = majorOf(version)
        if (major !== undefined && split.majors.includes(major)) continue
        const label = `${major ?? '?'}.x`
        at(
            lineOf(lock, name, version),
            `'${name}' ${describeCopy(lock, name, version)} is on ${label}, outside its allowed ${allowed}; move it onto an allowed line with an override, or add ${label} to its split with the reason`,
        )
    }
    for (const major of split.majors) {
        const onMajor = copies.filter(v => majorOf(v) === major)
        const [head] = onMajor
        if (head === undefined) {
            at(
                1,
                `'${name}' no longer resolves on ${major}.x; drop ${major}.x from its split in SINGLE_COPY_PACKAGES`,
            )
        } else if (onMajor.length > 1) {
            const listed = onMajor.map(v => describeCopy(lock, name, v))
            at(
                lineOf(lock, name, head),
                `'${name}' resolves to ${onMajor.length} versions on ${major}.x: ${listed.join(', ')}; ${COLLAPSE}`,
            )
        }
    }
}

const columnOf = (lines: readonly string[], line: number): number => {
    const text = lines[line - 1] ?? ''
    return text.length - text.trimStart().length + 1
}

export default defineRule({
    id: 'pera/single-copy-packages',
    severity: 'error',
    card: {
        message:
            'pnpm-lock.yaml resolves a second copy of a package the bundles must carry once',
        remediation:
            "Collapse the copies with an override in pnpm-workspace.yaml (a 'name@<major>' selector only for a closed major that no '^1 || ^2' range reaches, otherwise a bounded one such as 'name@<1.8.0', or 'parent>name' for an exact-pinned dependent) after checking the dependent imports only what the kept release exports, then run pnpm install. If both must stay, add a split with its reason to SINGLE_COPY_PACKAGES.",
        examples: {
            bad: "'@noble/hashes@1.7.0' and '@noble/hashes@1.8.0' both in pnpm-lock.yaml",
            good: "one '@noble/hashes' 1.x snapshot",
        },
    },
    language: 'yaml',
    gates: { pathMatches: ['**/pnpm-workspace.yaml'] },
    query: '(stream) @file',
    check(ctx, m) {
        if (m.file === undefined) return
        const wsPath = ctx.filePath
        const lockPath = join(dirOf(wsPath), LOCKFILE)
        const lockRaw = ctx.readFile(lockPath)
        const found: Finding[] = []
        if (lockRaw === undefined) {
            found.push({
                file: wsPath,
                line: 1,
                message: `${LOCKFILE} is missing beside pnpm-workspace.yaml, so no package can be checked for a second copy`,
            })
        } else {
            const lock = parsePnpmLock(lockRaw)
            for (const [name, split] of SINGLE_COPY_PACKAGES) {
                checkPackage(lock, name, split, lockPath, found)
            }
        }

        const linesOf = new Map<string, string[]>()
        for (const finding of found) {
            let lines = linesOf.get(finding.file)
            if (lines === undefined) {
                lines = (ctx.readFile(finding.file) ?? '').split('\n')
                linesOf.set(finding.file, lines)
            }
            // A fact's own `file` is the anchor, so the reported file travels as `path`.
            ctx.emitFact({
                kind: 'violation',
                path: finding.file,
                line: finding.line,
                column: columnOf(lines, finding.line),
                message: finding.message,
            })
        }
    },
    reduce(ctx) {
        for (const fact of ctx.facts('violation')) {
            ctx.report(
                {
                    file: String(fact.path),
                    line: Number(fact.line),
                    column: Number(fact.column),
                },
                String(fact.message),
            )
        }
    },
})
