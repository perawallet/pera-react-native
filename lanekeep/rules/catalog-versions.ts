/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { compareVersions, parsePnpmLock } from '../shared/pnpm-lock.js'
import type { PnpmLock } from '../shared/pnpm-lock.js'
import { dirOf, join, workspaceMembers, yamlMap } from '../shared/workspace.js'
import type { ReadCtx, YamlComment, YamlMapEntry } from '../shared/workspace.js'

const DEPENDENCY_FIELDS = new Set([
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
])

const MARKER_PREFIX = 'pin:'

// Anything that reads as an attempt at a marker, so a misspelling is reported
// instead of being taken for prose.
const LOOKS_LIKE_PIN = /^pin\b/i
const TRAILING_PIN = /\s#\s*(pin\b.*)$/i

type PinMarker =
    | { kind: 'lockstep'; group: string }
    | { kind: 'follows'; parent: string }
    | { kind: 'hold'; version: string }

const parsePinMarker = (text: string): PinMarker | undefined => {
    if (!text.startsWith(MARKER_PREFIX)) return undefined
    const tokens = text.slice(MARKER_PREFIX.length).trim().split(/\s+/)
    const [kind, arg] = tokens
    if (tokens.length !== 2 || kind === undefined || arg === undefined) {
        return undefined
    }
    if (kind === 'lockstep') return { kind, group: arg }
    if (kind === 'follows') return { kind, parent: arg }
    if (kind === 'hold' && compareVersions(arg, arg) !== undefined) {
        return { kind, version: arg }
    }
    return undefined
}

const columnOf = (lines: readonly string[], line: number): number => {
    const text = lines[line - 1] ?? ''
    return text.length - text.trimStart().length + 1
}

const isPin = (comment: YamlComment): boolean =>
    LOOKS_LIKE_PIN.test(comment.text)

interface Marked {
    entry: YamlMapEntry
    comment: YamlComment
    marker: PinMarker
}

interface Finding {
    file: string
    line: number
    message: string
}

/** A dependency spec found in a manifest, with its 1-based line. */
const manifestSpecs = (
    raw: string,
): { name: string; spec: string; line: number }[] => {
    const out: { name: string; spec: string; line: number }[] = []
    const lines = raw.split('\n')
    let topIndent = -1
    let inField = false
    for (let i = 0; i < lines.length; i++) {
        const text = lines[i] ?? ''
        const match = /^(\s*)"([^"]+)"\s*:\s*(.*?),?\s*$/.exec(text)
        if (match === null) continue
        const indent = (match[1] ?? '').length
        if (topIndent === -1) topIndent = indent
        if (indent === topIndent) {
            const value = match[3] ?? ''
            inField =
                DEPENDENCY_FIELDS.has(match[2] ?? '') &&
                value.startsWith('{') &&
                !value.endsWith('}')
        } else if (inField && indent > topIndent) {
            out.push({
                name: match[2] ?? '',
                spec: (match[3] ?? '').replace(/^"|"$/g, ''),
                line: i + 1,
            })
        }
    }
    return out
}

const checkCatalogUsage = (
    ctx: Pick<ReadCtx, 'readFile'>,
    base: string,
    members: readonly string[],
    catalog: ReadonlySet<string>,
    found: Finding[],
): void => {
    const manifests = ['package.json', ...members.map(m => `${m}/package.json`)]
    for (const manifest of manifests) {
        const file = join(base, manifest)
        const raw = ctx.readFile(file)
        if (raw === undefined) continue
        for (const { name, spec, line } of manifestSpecs(raw)) {
            if (!catalog.has(name)) continue
            if (spec === 'catalog:' || spec === 'catalog:default') continue
            found.push({
                file,
                line,
                message: `'${name}' has a catalog entry, so its spec must be 'catalog:', not '${spec}'`,
            })
        }
    }
}

const isBareName = (key: string): boolean =>
    !key.includes('>') && key.indexOf('@', 1) === -1

const checkOverrides = (
    catalog: readonly YamlMapEntry[],
    overrides: readonly YamlMapEntry[],
    wsPath: string,
    found: Finding[],
): void => {
    const byName = new Map(catalog.map(e => [e.key, e]))
    for (const override of overrides) {
        if (!isBareName(override.key)) continue
        const entry = byName.get(override.key)
        if (entry === undefined || entry.value === override.value) continue
        found.push({
            file: wsPath,
            line: entry.line,
            message: `'${entry.key}' is overridden to '${override.value}', so the catalog's '${entry.value}' never installs; set both to the same spec`,
        })
    }
}

const checkMarkers = (
    catalog: readonly YamlMapEntry[],
    wsPath: string,
    wsLines: readonly string[],
    lock: PnpmLock | undefined,
    found: Finding[],
): void => {
    const at = (line: number, message: string): void => {
        found.push({ file: wsPath, line, message })
    }

    const attached = new Set<number>()
    const marked: Marked[] = []
    const resolved = new Map<string, string>()
    for (const entry of catalog) {
        const pins = entry.comments.filter(isPin)
        for (const comment of pins) attached.add(comment.line)
        const markers: Marked[] = []
        for (const comment of pins) {
            const marker = parsePinMarker(comment.text)
            if (marker === undefined) {
                at(
                    comment.line,
                    `'${comment.text}' is not a pin marker: expected 'pin: lockstep <group>', 'pin: follows <catalog entry>' or 'pin: hold <version>'`,
                )
            } else {
                markers.push({ entry, comment, marker })
            }
        }
        if (markers.length === 0) continue
        const version = lock?.catalog.get(entry.key)
        if (version === undefined) {
            at(
                entry.line,
                `'${entry.key}' has a pin marker, but pnpm-lock.yaml's catalog has no resolved version for it`,
            )
            continue
        }
        resolved.set(entry.key, version)
        marked.push(...markers)
    }

    wsLines.forEach((text, i) => {
        const trimmed = text.trim()
        if (!trimmed.startsWith('#')) {
            const trailing = TRAILING_PIN.exec(text)?.[1]
            if (trailing !== undefined) {
                at(
                    i + 1,
                    `pin marker '${trailing.trim()}' is not directly above a catalog entry`,
                )
            }
            return
        }
        const comment = trimmed.slice(1).trim()
        if (!LOOKS_LIKE_PIN.test(comment) || attached.has(i + 1)) return
        at(
            i + 1,
            `pin marker '${comment}' is not directly above a catalog entry`,
        )
    })

    const groups = new Map<string, Marked[]>()
    for (const item of marked) {
        const { marker, entry, comment } = item
        const version = resolved.get(entry.key) ?? ''
        if (marker.kind === 'lockstep') {
            const members = groups.get(marker.group) ?? []
            if (!members.some(m => m.entry.key === entry.key)) {
                members.push(item)
            }
            groups.set(marker.group, members)
        } else if (marker.kind === 'follows') {
            const parentVersion = lock?.catalog.get(marker.parent)
            if (parentVersion === undefined) {
                at(
                    comment.line,
                    `'${entry.key}' follows '${marker.parent}', which pnpm-lock.yaml's catalog has no resolved version for`,
                )
                continue
            }
            const wanted = (
                lock?.snapshots.get(`${marker.parent}@${parentVersion}`) ?? []
            )
                .map(deps => deps.get(entry.key))
                .filter((v): v is string => v !== undefined)
            const [first] = wanted
            if (first === undefined) {
                at(
                    comment.line,
                    `'${marker.parent}' ${parentVersion} does not depend on '${entry.key}' in pnpm-lock.yaml`,
                )
                continue
            }
            const mismatch = wanted.find(v => v !== version)
            if (mismatch !== undefined) {
                at(
                    entry.line,
                    `'${entry.key}' resolves to ${version}, but '${marker.parent}' ${parentVersion} depends on ${mismatch}; move the two together`,
                )
            }
        } else {
            const order = compareVersions(version, marker.version)
            if (order === undefined) {
                at(
                    entry.line,
                    `'${entry.key}' resolves to '${version}', which is not a semver version to compare with its hold at ${marker.version}`,
                )
            } else if (order === 1) {
                at(
                    entry.line,
                    `'${entry.key}' resolves to ${version}, above its hold at ${marker.version}`,
                )
            }
        }
    }

    for (const [group, members] of groups) {
        const first = members[0]
        if (first === undefined) continue
        if (members.length < 2) {
            at(
                first.comment.line,
                `lockstep group '${group}' has only '${first.entry.key}'; a group needs at least two entries`,
            )
            continue
        }
        const versions = members.map(m => resolved.get(m.entry.key) ?? '')
        if (new Set(versions).size > 1) {
            const listed = members
                .map((m, i) => `${m.entry.key} ${versions[i]}`)
                .join(', ')
            at(
                first.entry.line,
                `lockstep group '${group}' resolves to more than one version: ${listed}`,
            )
        }
    }
}

export default defineRule({
    id: 'pera/catalog-versions',
    severity: 'error',
    card: {
        message:
            'a workspace dependency bypasses the catalog, or a pin in pnpm-workspace.yaml no longer holds in pnpm-lock.yaml',
        remediation:
            "Use 'catalog:' for any dependency the catalog lists. For a pin, move the entries together as the note above the marker says, or keep the bump out of the PR; raise a hold only after redoing the check its note names.",
        examples: {
            bad: 'a package.json with "some-lib": "^1.2.0" while the catalog lists some-lib',
            good: '"some-lib": "catalog:"',
        },
    },
    language: 'yaml',
    gates: { pathMatches: ['**/pnpm-workspace.yaml'] },
    query: '(stream) @file',
    check(ctx, m) {
        if (m.file === undefined) return
        const wsPath = ctx.filePath
        const raw = ctx.readFile(wsPath)
        if (raw === undefined) return
        const base = dirOf(wsPath)
        const catalog = yamlMap(raw, 'catalog')
        const found: Finding[] = []

        checkCatalogUsage(
            ctx,
            base,
            workspaceMembers(ctx, base),
            new Set(catalog.map(e => e.key)),
            found,
        )
        checkOverrides(catalog, yamlMap(raw, 'overrides'), wsPath, found)
        const lockRaw = ctx.readFile(join(base, 'pnpm-lock.yaml'))
        checkMarkers(
            catalog,
            wsPath,
            raw.split('\n'),
            lockRaw === undefined ? undefined : parsePnpmLock(lockRaw),
            found,
        )

        const linesOf = new Map<string, string[]>([[wsPath, raw.split('\n')]])
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
