import ts from 'typescript'
import { getLineCol } from '../utils/ast.js'
import type { Check } from '../types.js'

const RULE_ID = 'no-chrome-imports-outside-web'

// Only apps/mobile is at risk: its bundle is the one Metro builds for iOS and
// Android, where the `chrome` global does not exist. apps/browser is web-only
// by construction and packages/* are barred from chrome entirely by their own
// layering.
const MOBILE_SRC = '/apps/mobile/src/'

// Packages whose module bodies touch the ambient `chrome` global. Importing
// one of these for its VALUE pulls that code into whatever bundle the importer
// lands in.
const CHROME_ONLY_PACKAGES = [
    '@perawallet/wallet-extension-platform-chrome',
    '@perawallet/wallet-extension-keystore-chrome',
]

const isChromeOnly = (specifier: string): boolean =>
    CHROME_ONLY_PACKAGES.some(
        pkg => specifier === pkg || specifier.startsWith(`${pkg}/`),
    )

// Metro resolves `.web.tsx` only when platform === 'web', so these files are
// unreachable from a native bundle and may import freely.
const isWebOnlyFile = (fileName: string): boolean =>
    /\.web\.tsx?$/.test(fileName)

/**
 * Known web-only code that still lives under apps/mobile without a `.web.*`
 * suffix. Every entry is DEBT, not an exemption on principle — each is kept
 * out of the native bundle only because nothing native imports it, which is a
 * property no tool checks.
 *
 * The point of listing them explicitly is that the rule still fails for
 * anything NEW: a fresh chrome import outside these paths is a build error
 * rather than a runtime crash on device.
 *
 * To retire an entry, either move the code to apps/browser/src or rename the
 * file to `.web.tsx` (importers then need the explicit `.web` specifier, since
 * tsc has no platform resolution — see QRScannerContent.web's import for the
 * established pattern).
 */
const KNOWN_WEB_ONLY_PATHS = [
    // Whole modules that exist only for the extension. Not relocated yet:
    // both are built on apps/mobile's design system (modules/dapp alone has
    // ~48 imports of @components/@hooks/@modules/@theme), so moving them
    // would invert the app dependency and require apps/browser to replicate
    // apps/mobile's React Native test environment.
    'modules/dapp/',
    'modules/vault/',
    // NOT a web-only file. `settings/routes/index.tsx` is shared and imports
    // ConnectedSitesScreen / ConnectionsSettingsScreen unconditionally, so a
    // `.web` rename here would break the native build. Both screens are
    // capability-gated and never render on native, and the store already reads
    // `chrome` defensively off globalThis (returning null when absent), so it
    // is inert rather than broken — but it does bundle chrome-only code into
    // the native app. The real fix is to route it through the platform
    // provider like every other platform concern, or to import the screens
    // lazily. Tracked, not exempted on principle.
    'modules/settings/hooks/useDappConnectionsStore.ts',
]

const isKnownWebOnly = (fileName: string): boolean => {
    const idx = fileName.indexOf(MOBILE_SRC)
    if (idx === -1) return false
    const relative = fileName.slice(idx + MOBILE_SRC.length)
    return KNOWN_WEB_ONLY_PATHS.some(known => relative.startsWith(known))
}

/**
 * A type-only import emits nothing, so it cannot drag chrome code into the
 * native bundle. Covers both `import type {...}` and the per-specifier
 * `import { type Foo }` form — a declaration is only safe when EVERY binding
 * is type-only.
 */
const isTypeOnlyImport = (decl: ts.ImportDeclaration): boolean => {
    const clause = decl.importClause
    if (!clause) return false // bare side-effect import: runs the module body
    if (clause.isTypeOnly) return true
    if (clause.name) return false // default import binding is a value
    const bindings = clause.namedBindings
    if (!bindings) return false
    if (ts.isNamespaceImport(bindings)) return false
    return bindings.elements.every(element => element.isTypeOnly)
}

const check: Check = {
    id: RULE_ID,
    description:
        'Disallow value imports of chrome-only packages from files reachable by the native bundle. Web-only code belongs in apps/browser or a .web.* twin.',
    visitors: {
        [ts.SyntaxKind.ImportDeclaration]: (node, sf, emit) => {
            if (!sf.fileName.includes(MOBILE_SRC)) return
            if (isWebOnlyFile(sf.fileName)) return
            if (isKnownWebOnly(sf.fileName)) return

            const decl = node as ts.ImportDeclaration
            const spec = decl.moduleSpecifier
            if (!ts.isStringLiteral(spec) || !isChromeOnly(spec.text)) return
            if (isTypeOnlyImport(decl)) return

            const { line, column } = getLineCol(sf, spec.getStart(sf))
            emit({
                line,
                column,
                message: `'${spec.text}' reads the ambient \`chrome\` global, which does not exist on iOS or Android — this file is reachable from the native bundle`,
                remediation:
                    "Move the code to apps/browser/src, rename the file to a `.web.tsx` twin (Metro only resolves those when platform === 'web'), or make the import type-only if you need just its types.",
            })
        },
    },
}

export default check
