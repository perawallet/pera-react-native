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


const SDK_PACKAGES = ['algosdk', '@algorandfoundation/algokit-utils']

const isSdk = source =>
    SDK_PACKAGES.some(pkg => source === pkg || source.startsWith(`${pkg}/`))

// A pera rule rather than no-restricted-imports: oxlint overrides replace a
// rule's options instead of merging them, so any per-path no-restricted-imports
// override (the decimal.js ban) would silently drop this boundary. The root
// config turns it off for chain-algorand and packages/blockchain/src/models/index.ts,
// whose `Address` re-export is the sanctioned seam.
export const noAlgorandSdkImports = {
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'Import the Algorand SDK only inside packages/chain-algorand',
        },
        messages: {
            sdk: 'Import {{source}} only inside packages/chain-algorand.',
        },
        schema: [],
    },
    create(context) {
        const check = node => {
            const source = node.source
            if (source?.type !== 'Literal' || typeof source.value !== 'string') {
                return
            }
            if (!isSdk(source.value)) return
            context.report({
                node: source,
                messageId: 'sdk',
                data: { source: source.value },
            })
        }
        return {
            ImportDeclaration: check,
            ExportNamedDeclaration: check,
            ExportAllDeclaration: check,
            ImportExpression: check,
        }
    },
}
