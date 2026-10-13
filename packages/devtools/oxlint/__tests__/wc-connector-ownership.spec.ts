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

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
    WC_CONNECTOR_OWNERS,
    wcConnectorOwnership,
} from '../rules/wc-connector-ownership.js'
import { call, id, member, type Node } from './helpers.js'

describe('pera/wc-connector-ownership', () => {
    const lintNode = (
        visitor: 'NewExpression' | 'CallExpression',
        node: Node,
    ) => {
        const report = vi.fn()
        wcConnectorOwnership.create({ report })[visitor](node)
        return report
    }

    it.each([
        [
            'new WalletConnect(...)',
            'NewExpression',
            { type: 'NewExpression', callee: id('WalletConnect') },
        ],
        [
            'createWalletConnectConnector(...)',
            'CallExpression',
            call(id('createWalletConnectConnector'), []),
        ],
        [
            'a member createConnectorRegistry(...)',
            'CallExpression',
            call(member(id('walletconnect'), 'createConnectorRegistry'), []),
        ],
        [
            'createConnectorRegistry(...)',
            'CallExpression',
            call(id('createConnectorRegistry'), []),
        ],
        [
            'useWalletConnect()',
            'CallExpression',
            call(id('useWalletConnect'), []),
        ],
    ] as const)('reports %s', (_label, visitor, node) => {
        expect(lintNode(visitor, node)).toHaveBeenCalledOnce()
    })

    it.each([
        [
            'a look-alike hook',
            'CallExpression',
            call(id('useWalletConnectDeeplink'), []),
        ],
        [
            'another constructor',
            'NewExpression',
            { type: 'NewExpression', callee: id('WalletKit') },
        ],
    ] as const)('allows %s', (_label, visitor, node) => {
        expect(lintNode(visitor, node)).not.toHaveBeenCalled()
    })

    it('carves out only files that still own a connector', () => {
        const root = join(__dirname, '../../../..')
        const ownership =
            /\bnew WalletConnect\(|\bcreateWalletConnectConnector\(|\bcreateConnectorRegistry\(|\buseWalletConnect\(/
        for (const owner of WC_CONNECTOR_OWNERS) {
            const text = readFileSync(join(root, owner), 'utf8')
            expect(ownership.test(text), owner).toBe(true)
        }
    })

    it('is enabled by the root override for WC_CONNECTOR_OWNERS and by mobile for src/**', () => {
        const root = join(__dirname, '../../../..')
        const rootConfig = JSON.parse(
            readFileSync(join(root, '.oxlintrc.json'), 'utf8'),
        ) as {
            overrides: {
                files: string[]
                excludeFiles?: string[]
                rules: Record<string, string>
            }[]
        }
        const rootOverride = rootConfig.overrides.find(
            o => o.rules['pera/wc-connector-ownership'] === 'error',
        )
        expect(
            rootOverride?.excludeFiles?.filter(f => f.startsWith('packages/')),
        ).toEqual(WC_CONNECTOR_OWNERS)

        const mobileConfig = JSON.parse(
            readFileSync(join(root, 'apps/mobile/.oxlintrc.json'), 'utf8'),
        ) as {
            overrides: { files: string[]; rules: Record<string, string> }[]
        }
        const mobileOverride = mobileConfig.overrides.find(
            o => o.rules['pera/wc-connector-ownership'] === 'error',
        )
        expect(mobileOverride?.files).toEqual(['src/**'])
    })
})
