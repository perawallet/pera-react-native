/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'

const WALLETCONNECT_PACKAGE = '@perawallet/wallet-core-walletconnect'

export default defineRule({
    id: 'pera/no-wc-imports-in-connections-module',
    severity: 'error',
    card: {
        message:
            'the connections module and the deeplink handlers must not import the WalletConnect package',
        remediation:
            'Reach the protocol through the registry (pair, abandonPairing, describeUri, networksFor) or move the transport-agnostic piece into @perawallet/wallet-core-connections. apps/mobile/src/modules/connections and the deeplink pairing handlers are the layer that knows nothing about which protocol answered; one WalletConnect import there and every future handler has to be special-cased alongside it. Type-only imports count. A composition root (registering the handler, running its legacy import, the web twin the extension pairs through) suppresses this rule with a reason; nothing else should.',
        examples: {
            bad: "// in src/modules/connections/hooks/useConnectionPairing.ts\nimport { abandonPairing } from '@perawallet/wallet-core-walletconnect'",
            good: '// in src/modules/connections/hooks/useConnectionPairing.ts\nregistry.abandonPairing(pairingId)',
        },
    },
    gates: {
        // The deeplink handlers are in the lane too: they are a pairing entry
        // point that reaches the registry, so the same protocol-agnosticism
        // applies to them as to the module itself.
        pathMatches: [
            '**/apps/mobile/src/modules/connections/**',
            '**/apps/mobile/src/hooks/deeplink/handlers/**',
        ],
        fileContains: [WALLETCONNECT_PACKAGE],
    },
    // Every form that creates the dependency: static, `export … from`, and
    // a deferred `import()` — which still puts the module in the bundle.
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
        if (
            specifier !== WALLETCONNECT_PACKAGE &&
            !specifier.startsWith(`${WALLETCONNECT_PACKAGE}/`)
        ) {
            return
        }

        ctx.report(
            str,
            `${specifier} imported from the connections module — go through the registry instead`,
        )
    },
})
