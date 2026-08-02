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

// There is deliberately NO allowlist. Every candidate for one was retired
// instead: the web-only modules took `.web.*` names, and the last holdout (the
// dapp-connections store) turned out not to need chrome at all — it was
// importing a chrome-free store through platform-chrome's barrel.
//
// If you are reaching for an exemption, prefer, in order: import from the
// platform-agnostic package that actually owns the symbol; move the file to
// apps/browser/src; rename it `.web.tsx` (importers then need the explicit
// `.web` specifier, since tsc has no platform resolution).

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
