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

import fs from 'fs'
import path from 'path'

export type AliasEntry = { find: string; replacement: string }

type PackageJson = { name: string; exports?: Record<string, unknown> }

export type WorkspaceSourceAliasOptions = {
    /** Absolute paths of directories whose children are workspace packages. */
    packageRoots: string[]
    /** Package names to leave alone entirely, root and every subpath. */
    skipPackages?: ReadonlySet<string>
    /** Individual specifiers to leave alone (e.g. only a package's root). */
    skipSpecifiers?: ReadonlySet<string>
}

const TEST_HANDLERS_SUBPATH = './test-handlers'

const resolveSubpathSource = (packageDir: string, subpath: string): string => {
    const rest = subpath.slice(2)
    // A subpath is backed by either a flat file (src/constants.ts) or a
    // directory barrel (src/queue/index.ts); Metro's resolver tries the same two.
    const candidates =
        subpath === '.'
            ? [path.join(packageDir, 'src', 'index.ts')]
            : [
                  path.join(packageDir, 'src', `${rest}.ts`),
                  path.join(packageDir, 'src', rest, 'index.ts'),
              ]
    const found = candidates.find(candidate => fs.existsSync(candidate))
    if (!found) {
        throw new Error(
            `No source file for export "${subpath}" of ${packageDir}; tried ${candidates.join(', ')}`,
        )
    }
    return found
}

/**
 * Aliases every workspace package specifier (the `exports` map's keys plus
 * the test-only `/test-handlers` entry when `src/test-handlers.ts` exists)
 * to its source file, so tests never run a stale `dist`. Packages without a
 * `src/` directory ship their exported files as-is and are skipped.
 *
 * Vite matches a string alias on the exact specifier or as a `find + '/'`
 * prefix and takes the first hit, so the result is ordered longest-first:
 * a package root can never swallow one of its subpaths.
 */
export const workspaceSourceAliases = ({
    packageRoots,
    skipPackages = new Set(),
    skipSpecifiers = new Set(),
}: WorkspaceSourceAliasOptions): AliasEntry[] => {
    const aliases: AliasEntry[] = []
    for (const root of packageRoots) {
        for (const entry of fs.readdirSync(root).sort()) {
            const packageDir = path.join(root, entry)
            const manifestPath = path.join(packageDir, 'package.json')
            if (
                !fs.existsSync(manifestPath) ||
                !fs.existsSync(path.join(packageDir, 'src'))
            ) {
                continue
            }
            const manifest = JSON.parse(
                fs.readFileSync(manifestPath, 'utf8'),
            ) as PackageJson
            if (skipPackages.has(manifest.name)) continue

            const subpaths = Object.keys(manifest.exports ?? {}).filter(key =>
                key.startsWith('.'),
            )
            if (
                !subpaths.includes(TEST_HANDLERS_SUBPATH) &&
                fs.existsSync(path.join(packageDir, 'src', 'test-handlers.ts'))
            ) {
                subpaths.push(TEST_HANDLERS_SUBPATH)
            }

            for (const subpath of subpaths) {
                const find =
                    subpath === '.'
                        ? manifest.name
                        : `${manifest.name}${subpath.slice(1)}`
                if (skipSpecifiers.has(find)) continue
                aliases.push({
                    find,
                    replacement: resolveSubpathSource(packageDir, subpath),
                })
            }
        }
    }
    return aliases.sort(
        (a, b) => b.find.length - a.find.length || a.find.localeCompare(b.find),
    )
}

// tsconfig is JSONC. The TypeScript in this repo is the native compiler, which
// has no JS API to parse it, so strip comments and trailing commas here.
export const stripJsonComments = (text: string): string => {
    let out = ''
    let i = 0
    while (i < text.length) {
        const char = text[i]
        if (char === '"') {
            let end = i + 1
            while (end < text.length && text[end] !== '"') {
                end += text[end] === '\\' ? 2 : 1
            }
            out += text.slice(i, end + 1)
            i = end + 1
        } else if (text.startsWith('//', i)) {
            while (i < text.length && text[i] !== '\n') i++
        } else if (text.startsWith('/*', i)) {
            const end = text.indexOf('*/', i + 2)
            i = end === -1 ? text.length : end + 2
        } else {
            out += char
            i++
        }
    }
    return out.replace(/,(\s*[}\]])/g, '$1')
}

/**
 * Turns the app's own `compilerOptions.paths` (`@components/*` →
 * `./src/components/*`) into Vite aliases, so tests resolve exactly what tsc
 * type-checks. Package entries (`@perawallet/…`) are left to
 * {@link workspaceSourceAliases}.
 */
export const tsconfigPathAliases = (tsconfigPath: string): AliasEntry[] => {
    const config = JSON.parse(
        stripJsonComments(fs.readFileSync(tsconfigPath, 'utf8')),
    ) as { compilerOptions?: { paths?: Record<string, string[]> } }
    const paths = config.compilerOptions?.paths ?? {}
    const baseDir = path.dirname(tsconfigPath)
    const aliases = new Map<string, string>()
    for (const [key, targets] of Object.entries(paths)) {
        if (key.startsWith('@perawallet/')) continue
        const find = key.replace(/\/\*$/, '')
        const replacement = path.resolve(
            baseDir,
            targets[0].replace(/\/\*$/, ''),
        )
        const existing = aliases.get(find)
        if (existing && existing !== replacement) {
            throw new Error(
                `tsconfig paths map "${find}" to both ${existing} and ${replacement}`,
            )
        }
        aliases.set(find, replacement)
    }
    return [...aliases].map(([find, replacement]) => ({ find, replacement }))
}
