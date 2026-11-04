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

import { createRequire } from 'node:module'

const { EVM_CHAIN_PACKAGE, chainIdsOf, chainPackageNamed } = createRequire(
    import.meta.url,
)('../../../tools/dev/chain-packages.cjs')

// The chains chain-ethereum serves, from the table the Metro gate reads, so
// both builds agree on which chains need viem.
const EVM_CHAIN_IDS = chainIdsOf(chainPackageNamed(EVM_CHAIN_PACKAGE))

/**
 * Whether a build's chain list ships any EVM chain, and so needs viem.
 *
 * @param {readonly string[]} chainIds
 * @returns {boolean}
 */
export const listsEvmChain = chainIds =>
    chainIds.some(chainId => EVM_CHAIN_IDS.includes(chainId))

// viem's BaseError embeds `viem@<version>` in every message, and a string
// literal survives minification.
export const VIEM_MARKER = 'viem@'

/**
 * Throws when a bundle built for a CHAINS that lists no EVM chain still carries viem.
 *
 * @param {string} code
 * @param {string} surface
 */
export const assertNoViem = (code, surface) => {
    if (!code.includes(VIEM_MARKER)) return
    throw new Error(
        `${surface} contains viem but CHAINS lists no EVM chain: ` +
            'chain-ethereum got past the Metro chain gate ' +
            '(apps/mobile/metro-build-gates.js)',
    )
}

// Only the EVM provider build of content-inject-main.js carries the EIP-6963
// event name; a string literal, so it survives minification.
export const EVM_PROVIDER_MARKER = 'eip6963:announceProvider'

/**
 * Throws when a content script's EVM provider disagrees with the build's chain
 * list, i.e. `__PERA_SERVES_EVM__` was not baked from CHAINS.
 *
 * @param {string} code
 * @param {boolean} servesEvm
 * @param {string} surface
 */
export const assertEvmProviderMatchesChains = (code, servesEvm, surface) => {
    const hasProvider = code.includes(EVM_PROVIDER_MARKER)
    if (hasProvider === servesEvm) return
    throw new Error(
        hasProvider
            ? `${surface} installs the EVM provider but CHAINS lists no EVM chain: ` +
                  '__PERA_SERVES_EVM__ was not baked false'
            : `${surface} has no EVM provider but CHAINS lists an EVM chain: ` +
                  '__PERA_SERVES_EVM__ was not baked true',
    )
}
