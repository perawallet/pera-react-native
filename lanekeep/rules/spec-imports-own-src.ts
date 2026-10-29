/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import {
    IMPORT_SOURCES_QUERY,
    importSourceOf,
    isPackageOrSubpath,
} from '../shared/import-sources.js'
import { resolveRelative } from '../shared/paths.js'
import { TEST_FILES, TEST_SUPPORT } from '../shared/scope.js'
import { manifestNameOf, workspaceMemberOf } from '../shared/workspace.js'

// Vite resolves the first argument of these calls like an import.
const VI_LOADER_QUERY = `
    ((call_expression
       function: (member_expression
                   object: (identifier) @vi
                   property: (property_identifier) @method)
       arguments: (arguments . (string (string_fragment) @spec))) @site
     (#eq? @vi "vi")
     (#match? @method "^(mock|doMock|importActual|importMock)$"))
`

// Spans newlines: the real configs wrap `path.resolve(` onto the next line.
const ALIAS_ENTRY =
    /['"]([^'"]+)['"]\s*:\s*(?:path\.)?resolve\(\s*__dirname\s*,\s*['"]([^'"]+)['"]\s*,?\s*\)/g

/** The alias keys in `config` whose target lies inside `<dir>/src/`. */
const ownSrcAliases = (config: string, dir: string): ReadonlySet<string> => {
    const keys = new Set<string>()
    const configPath = `${dir}/vitest.config.ts`
    for (const [, key, target] of config.matchAll(ALIAS_ENTRY)) {
        if (key === undefined || target === undefined) continue
        if (resolveRelative(configPath, target).startsWith(`${dir}/src/`)) {
            keys.add(key)
        }
    }
    return keys
}

export default defineRule({
    id: 'pera/spec-imports-own-src',
    severity: 'error',
    card: {
        message:
            'test code imports its own package by name, which resolves to its built dist instead of src',
        remediation:
            "Import the source file relatively. Only where the specifier must stay (another package's source aliased into this suite imports it), alias that exact specifier to `src` in this package's `vitest.config.ts` with `path.resolve(__dirname, 'src/…')`. `test` waits only on `^build`, so the package's own dist is stale or missing when its suite runs.",
        examples: {
            bad: "// packages/passkeys/src/native/__tests__/writeNativePasskeyEntry.spec.ts\nimport { openNativeProviderRecord } from '@perawallet/wallet-core-passkeys/native'",
            good: "import { openNativeProviderRecord } from '../nativeProviderRecord'",
        },
    },
    gates: {
        pathMatches: [
            ...TEST_FILES,
            ...TEST_SUPPORT,
            '**/{packages,extensions}/*/vitest.setup.ts',
        ],
        fileContains: ['@perawallet/'],
    },
    query: `${IMPORT_SOURCES_QUERY}\n${VI_LOADER_QUERY}`,
    check(ctx, m) {
        const source = importSourceOf(ctx, m)
        if (source === undefined) return
        const member = workspaceMemberOf(ctx.filePath)
        if (member === undefined || member.root === 'apps') return
        const name = manifestNameOf(ctx, member.dir)
        if (name === undefined || !isPackageOrSubpath(source.specifier, name)) {
            return
        }
        const config = ctx.readFile(`${member.dir}/vitest.config.ts`) ?? ''
        if (ownSrcAliases(config, member.dir).has(source.specifier)) return
        ctx.report(
            source.site,
            `'${source.specifier}' is ${name} itself and resolves to its dist; import from src relatively, or alias '${source.specifier}' to src in vitest.config.ts`,
        )
    },
})
