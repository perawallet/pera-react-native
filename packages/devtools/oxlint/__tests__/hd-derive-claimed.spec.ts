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

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
    hdDeriveClaimed,
    UNCLAIMED_DERIVE_FILES,
} from '../rules/hd-derive-claimed.js'
import {
    call,
    id,
    member,
    overridesWith,
    readOxlintConfig,
    type Node,
} from './helpers.js'

// Links each node to its parent, as the linter does before rules run.
const withParents = (node: Node, parent?: Node): Node => {
    node.parent = parent
    for (const [key, value] of Object.entries(node)) {
        if (key === 'parent') continue
        const children = Array.isArray(value) ? value : [value]
        for (const child of children) {
            if (child && typeof child === 'object' && 'type' in child) {
                withParents(child as Node, node)
            }
        }
    }
    return node
}

describe('pera/hd-derive-claimed', () => {
    const lintCall = (node: Node) => {
        const report = vi.fn()
        hdDeriveClaimed.create({ report }).CallExpression(node)
        return report
    }
    const derive = (method: string) =>
        call(member(id('derivation'), method), [id('kms'), id('seed')])

    it.each(['deriveAccount', 'deriveHdAccount'])(
        'reports %s called outside a claim',
        method => {
            const node = derive(method)
            withParents(call(id('run'), [node]))

            expect(lintCall(node)).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({ data: { method } }),
            )
        },
    )

    it('allows a derive inside deriveClaimedHdKey', () => {
        const node = derive('deriveAccount')
        withParents(
            call(id('deriveClaimedHdKey'), [
                id('chainId'),
                id('seed'),
                id('index'),
                { type: 'ArrowFunctionExpression', params: [], body: node },
            ]),
        )

        expect(lintCall(node)).not.toHaveBeenCalled()
    })

    it('ignores other methods and plain function calls', () => {
        const other = call(member(id('derivation'), 'importRawKey'), [])
        const plain = call(id('deriveHdAccount'), [])
        withParents(other)
        withParents(plain)

        expect(lintCall(other)).not.toHaveBeenCalled()
        expect(lintCall(plain)).not.toHaveBeenCalled()
    })

    it('runs over package sources, leaving out exactly the unclaimed derive files, which still exist', () => {
        const [override, ...rest] = overridesWith(
            readOxlintConfig('.oxlintrc.json'),
            'pera/hd-derive-claimed',
        )

        expect(rest).toEqual([])
        expect(override.files).toEqual(['packages/*/src/**'])
        expect(override.excludeFiles).toEqual(
            expect.arrayContaining(UNCLAIMED_DERIVE_FILES),
        )
        const root = join(__dirname, '../../../..')
        for (const path of UNCLAIMED_DERIVE_FILES) {
            expect(existsSync(join(root, path)), path).toBe(true)
        }
    })
})
