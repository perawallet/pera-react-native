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

/**
 * Files that derive HD keys no account is about to store, relative to the
 * repo root, so a walk deleting them loses nothing.
 */
export const UNCLAIMED_DERIVE_FILES = [
    // The walk's own probes: these are the keys its cleanup removes.
    'packages/accounts/src/hd-walk.ts',
    // `discover` implementations; the app's walks never call them.
    'packages/chain-algorand/src/accounts/key-derivation.ts',
    'packages/chain-ethereum/src/accounts/key-derivation.ts',
    // Re-derives the key of an account already stored, which cleanup keeps.
    'packages/backup/src/cloud/hooks/useResolveHdSeedForBackup.ts',
]

const DERIVE_METHODS = new Set(['deriveAccount', 'deriveHdAccount'])
const CLAIM = 'deriveClaimedHdKey'

const isClaimCall = node =>
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === CLAIM

export const hdDeriveClaimed = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Derive an HD key for an account inside deriveClaimedHdKey',
        },
        messages: {
            unclaimed:
                '{{method}} saves an HD key a discovery walk may delete before its account is stored: run it inside deriveClaimedHdKey, or use deriveHdKeyForAccount.',
        },
        schema: [],
    },
    create(context) {
        return {
            CallExpression(node) {
                const { callee } = node
                if (
                    callee.type !== 'MemberExpression' ||
                    callee.computed ||
                    !DERIVE_METHODS.has(callee.property.name)
                ) {
                    return
                }
                for (let up = node.parent; up; up = up.parent) {
                    if (isClaimCall(up)) return
                }
                context.report({
                    node,
                    messageId: 'unclaimed',
                    data: { method: callee.property.name },
                })
            },
        }
    },
}
