/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { withoutTests } from '../shared/scope.js'
import { resolveRelative } from '../shared/paths.js'

const MODULES_DIR = 'apps/mobile/src/modules/'

// Every module's public entries. `web` resolves only in a web build, so it is
// reachable from `.web.ts(x)` files alone.
const ENTRIES = new Set(['', 'index', 'routes', 'shell', 'web'])

// Narrower entries a module documents in the file itself, each for a reason
// the generic ones can't express: the banner carousels would drag a pager into
// every HomeBannersStrip consumer, deeplink's handlers import the modules that
// need its parser and constants, PWWebView mounts the whole dApp bridge, and
// the locale tour's register/registry are the files metro.config.js stubs out
// of release builds.
const EXTRA_ENTRIES: Record<string, readonly string[]> = {
    banners: ['carousel'],
    deeplink: ['core'],
    'locale-tour': ['register', 'registry'],
    webview: ['browser'],
}

// The developer gallery renders every module's internals by design, and the
// locale tour drives the gallery's catalog. Both are dev tooling.
const GALLERY = `${MODULES_DIR}settings/screens/developer/`
const isAllowListed = (filePath: string, target: string, rest: string) =>
    filePath.includes(GALLERY) ||
    (filePath.includes(`${MODULES_DIR}locale-tour/`) &&
        target === 'settings' &&
        rest.startsWith('screens/developer/'))

/** The module a file lives in, or undefined for app files outside modules/. */
const moduleOf = (filePath: string): string | undefined => {
    const at = filePath.indexOf(MODULES_DIR)
    if (at === -1) return undefined
    return filePath.slice(at + MODULES_DIR.length).split('/')[0]
}

/** `[module, rest]` for a specifier that lands in apps/mobile/src/modules, else undefined. */
const targetOf = (
    specifier: string,
    filePath: string,
): [string, string] | undefined => {
    let inModules: string | undefined
    if (specifier.startsWith('@modules/')) {
        inModules = specifier.slice('@modules/'.length)
    } else if (specifier.startsWith('.')) {
        const resolved = resolveRelative(filePath, specifier)
        const at = resolved.indexOf(MODULES_DIR)
        if (at === -1) return undefined
        inModules = resolved.slice(at + MODULES_DIR.length)
    }
    if (inModules === undefined) return undefined
    const [target, ...rest] = inModules.split('/')
    return [target, rest.join('/')]
}

const isWebFile = (filePath: string) => /\.web\.tsx?$/.test(filePath)

export default defineRule({
    id: 'pera/no-deep-module-imports',
    severity: 'error',
    card: {
        message:
            "an app module's internals must not be imported from outside the module",
        remediation:
            "Import from the module's public entry: `@modules/<name>` for components, hooks, utils and types; `@modules/<name>/routes` for navigators, screens other navigators mount, and sheets that host their own navigator; `@modules/<name>/shell` for what the app shell mounts once (providers, root overlays, guards); `@modules/<name>/web` from `.web` files only. If the symbol isn't exported yet, export it from the right entry. If it is shared by many modules and belongs to none, move it to src/components, src/hooks or src/utils. Type-only imports count: the boundary is about coupling.",
        examples: {
            bad: "// in src/modules/card/...\nimport { AccountPicker } from '@modules/accounts/components/AccountPicker'",
            good: "// in src/modules/card/...\nimport { AccountPicker } from '@modules/accounts'",
        },
    },
    gates: withoutTests({ pathMatches: ['**/apps/mobile/src/**'] }),
    // Every form that creates the dependency: static, `export … from`, and a
    // deferred `import()`.
    query: `
        (import_statement (string (string_fragment) @src) @str)
        (export_statement (string (string_fragment) @src) @str)
        (call_expression
          function: (import)
          arguments: (arguments (string (string_fragment) @src) @str))
    `,
    check(ctx, m) {
        const src = m.src
        const str = m.str
        if (src === undefined || str === undefined) return

        const specifier = ctx.text(src)
        if (specifier === undefined) return
        const found = targetOf(specifier, ctx.filePath)
        if (found === undefined) return
        const [target, rest] = found
        if (target === moduleOf(ctx.filePath)) return
        if (isAllowListed(ctx.filePath, target, rest)) return

        if (rest === 'web' && !isWebFile(ctx.filePath)) {
            ctx.report(
                str,
                `${specifier} is web-only — import it from a .web.ts(x) file`,
            )
            return
        }
        if (ENTRIES.has(rest) || EXTRA_ENTRIES[target]?.includes(rest)) return

        ctx.report(
            str,
            `${specifier} reaches into ${target}'s internals — import from @modules/${target} (or its routes/shell entry)`,
        )
    },
})
