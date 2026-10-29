/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import type { Match } from 'lanekeep'
import { COMPOSITION_ROOTS } from '../shared/chain-package-allowlist.js'
import { TEST_SUPPORT, withoutTests } from '../shared/scope.js'

/**
 * Mirrors `CHAIN_IDS` in packages/chain-contract/src/models/identity.ts, which
 * lanekeep's rule loader can't import. The spec fails until the two match.
 */
export const CHAIN_IDS = [
    'algorand',
    'ethereum',
    'base',
    'bsc',
    'arbitrum',
    'avalanche',
    'polygon',
] as const

// An app pins the legacy chain at its own call sites, so a chain id literal
// there is fine; branching on one is not.
const APP_SOURCE = /(^|\/)apps\/[^/]+\/src\//

const IDENTITY_PROPS = '"chainId" "family"'
const EQUALITY_OPERATORS = new Set(['===', '!==', '==', '!='])

type Allowed = {
    file: string
    text: string
    reason: string
}

// Matched by path suffix plus the reported node's text. Only code that stays
// correct once every chain has its own package belongs here; debt stays
// reported.
const ALLOWED: readonly Allowed[] = [
    {
        file: 'packages/chain-contract/src/scope.ts',
        text: "'algorand'",
        reason: 'Legacy shim: every row stored before scope keys existed belongs to this chain.',
    },
    {
        file: 'packages/chain-contract/src/scope.ts',
        text: '(part as Partial<ChainScope>).chainId === scope.chainId',
        reason: "Compares a query key's scope against whichever scope the caller passes, never a named chain.",
    },
    {
        file: 'packages/chain-contract/src/scope.ts',
        text: '(part as Partial<ChainScope>).chainId === chainId',
        reason: "Compares a query key's scope against whichever chain the caller passes, never a named chain.",
    },
    {
        file: 'packages/dapp/src/handler.ts',
        text: 'scope.chainId === deps.chainId',
        reason: 'Matches whichever chain the handler was built for, never a named chain.',
    },
    {
        file: 'packages/dapp/src/eip1193Handler.ts',
        text: 'connection.metadata.chainId === chainId',
        reason: "Checks a site's stored chain against whichever chain the caller passes, never a named chain.",
    },
    {
        file: 'apps/browser/src/content/eip1193-main.ts',
        text: 'method === EIP1193_METHOD.chainId',
        reason: 'Matches the eth_chainId method name, not a ChainId.',
    },
    {
        file: 'packages/walletconnect/src/v2/handler.ts',
        text: 'event.params.chainId !== activeChainId',
        reason: "WalletConnect's chainId is a CAIP-2 string, not a ChainId.",
    },
    {
        file: 'packages/migrate/src/migrate/migrateWalletConnect.ts',
        text: 'fields.chainId != null',
        reason: "A legacy WalletConnect v1 session's chainId is its numeric chain id, not a ChainId.",
    },
    {
        file: 'packages/chain-contract/src/models/domain.ts',
        text: 'ref.chainId === descriptor.id',
        reason: 'Compares against whichever descriptor the caller passes, never a named chain.',
    },
    {
        file: 'apps/mobile/src/modules/accounts/components/AccountOverview/useAccountOverviewHeader.ts',
        text: 'source.scope.chainId === scope.chainId',
        reason: "Checks each holding source against whichever chain the account's chart plots, never a named chain.",
    },
    {
        file: 'apps/mobile/src/modules/accounts/components/PortfolioView/usePortfolioView.ts',
        text: 'accountChainIdOf(account, registeredChainIds) === scope.chainId',
        reason: 'Checks each account against whichever chain the portfolio chart plots, never a named chain.',
    },
    {
        file: 'packages/chain-contract/src/models/domain.ts',
        text: "'algorand'",
        reason: 'The contract declares one discriminated-union variant per chain family; new chains add variants beside it.',
    },
    {
        file: 'packages/device/src/registrations/withoutNewestChain.ts',
        text: 'account.chainId !== newest',
        reason: 'Drops whichever chain was added most recently, never a named chain.',
    },
    {
        file: 'packages/accounts/src/credentials/accessors.ts',
        text: 'scope.chainId !== LEGACY_CHAIN_ID',
        reason: "The legacy rekey fields it reads are the Algorand chain's; per-chain authority replaces them.",
    },
    {
        file: 'packages/signing/src/hooks/usePlannerHook.ts',
        text: 'planner.chainId === chainId',
        reason: "Picks the caller's chain's planner while every planner's hook still runs; never a named chain.",
    },
    {
        file: 'packages/onramp/src/token-identity.ts',
        text: 'rampTokenChainId(token) !== scope.chainId',
        reason: 'Checks a ramp token lives on whichever scope the caller passes, never a named chain.',
    },
    {
        file: 'apps/browser/src/offscreen/connections/connectionsHost.ts',
        text: 'scope.chainId !== request.chainId',
        reason: "Refuses a handed-off send signed for another chain than its own request's; compares two passed values, never a named chain.",
    },
    {
        file: 'apps/mobile/src/components/PreferredAmount/usePreferredAmount.ts',
        text: 'assetScope.chainId === currencyScope.chainId',
        reason: "Asks whether the asset lives on the currency's chain; compares two passed scopes, never a named chain.",
    },
    {
        file: 'apps/mobile/src/modules/accounts/hooks/useSelectedNetworkSource.ts',
        text: 'source.scope.chainId === storedChainId',
        reason: "Checks the stored network chip is one of the viewed account's chains; compares two passed values, never a named chain.",
    },
    {
        file: 'apps/mobile/src/modules/accounts/components/AccountAssetList/useAccountAssetList.tsx',
        text: 'source.scope.chainId === selectedChainId',
        reason: 'Narrows the asset list to whichever chain the selected chip names, never a named chain.',
    },
    {
        file: 'apps/mobile/src/modules/accounts/components/AccountAssetList/useAccountAssetList.tsx',
        text: 'item.scope.chainId === scope.chainId',
        reason: "Opt-out is bound to the account's own chain; compares a holding's chain with it, never a named chain.",
    },
    {
        file: 'packages/config/src/network-config.ts',
        text: 'row.scope.chainId === scope.chainId',
        reason: "Compares a table row's scope against whichever scope the caller passes, never a named chain.",
    },
    {
        file: 'packages/config/src/network-config.ts',
        text: "'algorand'",
        reason: "The build's endpoint table types each chain's rows by its chain id; a new chain adds its own rows.",
    },
    {
        file: 'packages/config/src/main.ts',
        text: "'algorand'",
        reason: 'The chains a build enables when its environment names none.',
    },
    {
        file: 'apps/mobile/src/modules/assets/components/holdings/AssetActionButtons/useAssetActionButtons.ts',
        text: 'useSwapScope(account ?? null)?.chainId === chainId',
        reason: "Checks the account's swap scope lands on whichever asset chain the caller passes, never a named chain.",
    },
    {
        file: 'apps/mobile/src/modules/assets/components/holdings/AssetActionButtons/useAssetActionButtons.ts',
        text: 'useOnrampScope(account?.chains ?? null)?.chainId === chainId',
        reason: "Checks the account's onramp scope lands on whichever asset chain the caller passes, never a named chain.",
    },
    {
        file: 'packages/deeplinks/src/pera-link-chain.ts',
        text: "'algorand'",
        reason: "A Pera link without chain= is Algorand's, as every link issued before the param was; this file is their one legacy default.",
    },
    {
        file: 'apps/mobile/src/components/AccountIcon/useAccountIcon.ts',
        text: "'base'",
        reason: 'An account presentation kind, not a ChainId.',
    },
    {
        file: 'packages/search/src/hooks/useGlobalSearch.ts',
        text: "'base'",
        reason: "Intl.Collator's sensitivity option, not a ChainId.",
    },
    {
        file: 'apps/mobile/src/modules/gift-card/hooks/useBidaliTransport.ts',
        text: "'algorand'",
        reason: "Bidali's payment-currency code, not a ChainId.",
    },
]

const reportMessageOf = (m: Match, text: string, where: string): string => {
    if (m.lit !== undefined) {
        return `\`${text}\` is a chain id literal in ${where}`
    }
    if (m.cmp !== undefined) {
        return `\`${text}\` is compared as a chain id in ${where}`
    }
    return `\`${text}\` branches on chain identity in ${where}`
}

export default defineRule({
    id: 'pera/no-chain-identity-in-shared-packages',
    severity: 'error',
    card: {
        message:
            'A chain-independent package must not branch on chain identity or name a chain',
        remediation:
            "Move the chain-specific behaviour into the chain's own package and reach it through the chain module or a capability. Code that is correct for every chain forever (a legacy shim, a non-ChainId field that happens to be called chainId) goes on the ALLOWED list in this rule with a one-line reason.",
        examples: {
            bad: "if (scope.chainId === 'algorand') {\n    return algodFee()\n}",
            good: '// The chain package supplies `chain`; this code never asks which one it is.\nreturn chain.estimateFee()',
        },
    },
    gates: withoutTests({
        pathMatches: ['**/packages/*/src/**', '**/apps/*/src/**'],
        pathNotMatches: [
            `**/packages/chain-{${CHAIN_IDS.join(',')}}/**`,
            '**/packages/chain-contract/src/models/identity.ts',
            ...TEST_SUPPORT,
            ...COMPOSITION_ROOTS.map(root => root.glob),
        ],
    }),
    // ponytail: member access only, no type information, so a destructured
    // `switch (chainId)` is missed; walletconnect's CAIP-2 `chainId`s would
    // otherwise be false positives. Upgrade: `requires: ['types']` and match
    // on the ChainId type.
    query: `
        ((switch_statement
          value: (parenthesized_expression
            (member_expression property: (property_identifier) @prop)) @at)
         (#any-of? @prop ${IDENTITY_PROPS}))
        ((binary_expression
          left: (member_expression property: (property_identifier) @prop)
          operator: _ @op) @at
         (#any-of? @prop ${IDENTITY_PROPS}))
        ((binary_expression
          operator: _ @op
          right: (member_expression property: (property_identifier) @prop)) @at
         (#any-of? @prop ${IDENTITY_PROPS}))
        ((string (string_fragment) @lit) @at
         (#any-of? @lit ${CHAIN_IDS.map(id => `"${id}"`).join(' ')}))
        ((binary_expression
          left: (string (string_fragment) @cmp) @at
          operator: _ @op)
         (#any-of? @cmp ${CHAIN_IDS.map(id => `"${id}"`).join(' ')}))
        ((binary_expression
          operator: _ @op
          right: (string (string_fragment) @cmp) @at)
         (#any-of? @cmp ${CHAIN_IDS.map(id => `"${id}"`).join(' ')}))
        ((switch_case value: (string (string_fragment) @cmp) @at)
         (#any-of? @cmp ${CHAIN_IDS.map(id => `"${id}"`).join(' ')}))
    `,
    check(ctx, m) {
        const at = m.at
        if (at === undefined) return
        const isApp = APP_SOURCE.test(ctx.filePath)
        // A package reports every literal through `@lit`; an app only the
        // ones it compares.
        if (isApp ? m.lit !== undefined : m.cmp !== undefined) return
        if (
            m.op !== undefined &&
            !EQUALITY_OPERATORS.has(ctx.text(m.op) ?? '')
        ) {
            return
        }

        const text = ctx.text(at) ?? ''
        const isAllowed = ALLOWED.some(
            entry => ctx.filePath.endsWith(entry.file) && entry.text === text,
        )
        if (isAllowed) return

        const where = isApp ? 'app code' : 'a shared package'
        ctx.report(at, reportMessageOf(m, text, where))
    },
})
