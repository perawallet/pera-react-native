import ts from 'typescript'
import { getLineCol } from '../utils/ast.js'
import type { Check } from '../types.js'

const RULE_ID = 'restrict-pera-service-fallback-importers'

// The only files allowed to consume the fallback. Keeping this list pinned is
// what makes the fallback removable in one move when real Pera backends ship
// for betanet/custom.
const ALLOWED_IMPORTERS = [
    // The module itself and the barrel that re-exports it.
    '/packages/config/src/pera-service-fallback.ts',
    '/packages/config/src/index.ts',
    // Real consumers. Adding a row here is a deliberate decision: say why in the PR.
    '/packages/config/src/network-config.ts',
    '/packages/shared/src/api/query-client.ts',
    '/packages/assets/src/models/assets.ts',
    '/packages/assets/src/hooks/useSingleAssetDetailsQuery.ts',
    // Keeps the borrowed Pera response out of assets_node's chain-intrinsic
    // columns (decimals above all) on the sync path that populates the DB the
    // send flow reads back. Twin of useSingleAssetDetailsQuery's
    // withChainIntrinsics, which only covers the DB-miss API path.
    '/packages/assets/src/sync/asset-syncer.ts',
    '/packages/transactions/src/api/history/endpoints.ts',
]

// Symbols that only exist to serve the fallback.
const FALLBACK_SYMBOLS = new Set([
    'PERA_SERVICE_FALLBACK',
    'resolvePeraServiceNetwork',
    'resolvePeraServiceLane',
    'hasPeraServiceFallback',
])

const REMEDIATION =
    'Do not add new consumers of pera-service-fallback. Resolve services through getNetworkConfig(network) instead, which already applies the fallback. If a genuinely new seam is required, update ALLOWED_IMPORTERS in this check and say why in the PR.'

const check: Check = {
    id: RULE_ID,
    description:
        'Pin the pera-service-fallback importer allowlist so the temporary testnet fallback stays deletable in one move.',
    visitors: {
        [ts.SyntaxKind.ImportDeclaration]: (node, sf, emit) => {
            const normalized = sf.fileName.replaceAll('\\', '/')
            if (
                ALLOWED_IMPORTERS.some(allowed => normalized.endsWith(allowed))
            ) {
                return
            }

            const decl = node as ts.ImportDeclaration
            const bindings = decl.importClause?.namedBindings
            if (!bindings || !ts.isNamedImports(bindings)) return

            for (const element of bindings.elements) {
                const imported = element.propertyName?.text ?? element.name.text
                if (!FALLBACK_SYMBOLS.has(imported)) continue

                const { line, column } = getLineCol(sf, element.getStart(sf))
                emit({
                    line,
                    column,
                    message: `${imported} comes from pera-service-fallback, which must keep a pinned importer list`,
                    remediation: REMEDIATION,
                })
            }
        },
    },
}

export default check
