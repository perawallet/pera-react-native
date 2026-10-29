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

import { describe, expect, it, vi } from 'vitest'
import { fetchHasDeadline } from '../rules/fetch-has-deadline.js'
import {
    call,
    id,
    member,
    overridesWith,
    readOxlintConfig,
    withParents,
    type Node,
} from './helpers.js'

const RULE = 'pera/fetch-has-deadline'

const str = (value: string): Node => ({ type: 'Literal', value })
const property = (key: Node, value: Node, computed = false): Node => ({
    type: 'Property',
    computed,
    key,
    value,
    shorthand: false,
})
const shorthand = (name: string): Node => ({
    ...property(id(name), id(name)),
    shorthand: true,
})
const spread = (argument: Node): Node => ({ type: 'SpreadElement', argument })
const object = (...properties: Node[]): Node => ({
    type: 'ObjectExpression',
    properties,
})
const arrow = (body: Node): Node => ({
    type: 'ArrowFunctionExpression',
    params: [],
    body,
})
const importFrom = (source: string, imported: Node, local: string): Node => ({
    type: 'ImportDeclaration',
    source: str(source),
    specifiers: [{ type: 'ImportSpecifier', imported, local: id(local) }],
})
const importShared = (imported: string, local = imported): Node =>
    importFrom('@perawallet/wallet-core-shared', id(imported), local)

const lint = (node: Node, imports: Node[] = []) => {
    const report = vi.fn()
    const visitor = fetchHasDeadline.create({ report })
    for (const declaration of imports) visitor.ImportDeclaration(declaration)
    visitor.CallExpression(node)
    return report
}

const fetchCall = (...args: Node[]) => call(id('fetch'), args)
const url = id('url')

describe(RULE, () => {
    it.each<[string, () => { fetch: Node; root: Node }, Node[]?]>([
        ['fetch(url)', () => wrap(fetchCall(url))],
        [
            "fetch(url, { method: 'POST' })",
            () =>
                wrap(
                    fetchCall(url, object(property(id('method'), str('POST')))),
                ),
        ],
        [
            'globalThis.fetch(url)',
            () => wrap(call(member(id('globalThis'), 'fetch'), [url])),
        ],
        [
            'window.fetch(url)',
            () => wrap(call(member(id('window'), 'fetch'), [url])),
        ],
        [
            "fetch(url, { ['signal']: s })",
            () =>
                wrap(
                    fetchCall(
                        url,
                        object(property(str('signal'), id('s'), true)),
                    ),
                ),
        ],
        [
            'run(fetch(url))',
            () => {
                const inner = fetchCall(url)
                return { fetch: inner, root: call(id('run'), [inner]) }
            },
        ],
        [
            "withTimeout(fetch(url), ms, 'op') imported from ./timeout",
            () => timeoutAround(fetchCall(url)),
            [importFrom('./timeout', id('withTimeout'), 'withTimeout')],
        ],
        [
            "withTimeout(fetch(url), ms, 'op') with no import",
            () => timeoutAround(fetchCall(url)),
        ],
        [
            'withTimeout(ms, fetch(url)) with the shared import (not the first argument)',
            () => {
                const inner = fetchCall(url)
                return {
                    fetch: inner,
                    root: call(id('withTimeout'), [id('ms'), inner]),
                }
            },
            [importShared('withTimeout')],
        ],
    ])('reports %s', (_label, build, imports = []) => {
        const { fetch, root } = build()
        withParents(root)

        expect(lint(fetch, imports)).toHaveBeenCalledExactlyOnceWith({
            node: fetch,
            messageId: 'missingDeadline',
        })
    })

    it.each<[string, () => { fetch: Node; root: Node }, Node[]?]>([
        [
            'fetch(url, { signal })',
            () => wrap(fetchCall(url, object(shorthand('signal')))),
        ],
        [
            'fetch(url, { method, signal: AbortSignal.timeout(ms) })',
            () =>
                wrap(
                    fetchCall(
                        url,
                        object(
                            property(id('method'), str('POST')),
                            property(
                                id('signal'),
                                call(member(id('AbortSignal'), 'timeout'), [
                                    id('ms'),
                                ]),
                            ),
                        ),
                    ),
                ),
        ],
        [
            "fetch(url, { 'signal': s })",
            () =>
                wrap(fetchCall(url, object(property(str('signal'), id('s'))))),
        ],
        [
            'fetch(url, init), options built elsewhere',
            () => wrap(fetchCall(url, id('init'))),
        ],
        [
            'fetch(url, buildInit())',
            () => wrap(fetchCall(url, call(id('buildInit'), []))),
        ],
        [
            "fetch(url, { ...init, method: 'POST' })",
            () =>
                wrap(
                    fetchCall(
                        url,
                        object(
                            spread(id('init')),
                            property(id('method'), str('POST')),
                        ),
                    ),
                ),
        ],
        ['fetch(...args)', () => wrap(fetchCall(spread(id('args'))))],
        [
            "withTimeout(fetch(url), ms, 'op') imported from the shared package",
            () => timeoutAround(fetchCall(url)),
            [importShared('withTimeout')],
        ],
        [
            'an aliased shared withTimeout',
            () => timeoutAround(fetchCall(url), 'deadline'),
            [importShared('withTimeout', 'deadline')],
        ],
        [
            'withTimeout(fetch(url).then(...), ms, op)',
            () => {
                const inner = fetchCall(url)
                const chained = call(member(inner, 'then'), [
                    arrow(id('response')),
                ])
                return {
                    fetch: inner,
                    root: call(id('withTimeout'), [
                        chained,
                        id('ms'),
                        str('op'),
                    ]),
                }
            },
            [importShared('withTimeout')],
        ],
        [
            'client.fetch(url), a method on another object',
            () => wrap(call(member(id('client'), 'fetch'), [url])),
        ],
        [
            'a function that is not fetch',
            () => wrap(call(id('refetch'), [url])),
        ],
    ])('allows %s', (_label, build, imports = []) => {
        const { fetch, root } = build()
        withParents(root)

        expect(lint(fetch, imports)).not.toHaveBeenCalled()
    })

    it('ships at error over production source in both configs', () => {
        const [root, ...rootRest] = overridesWith(
            readOxlintConfig('.oxlintrc.json'),
            RULE,
        )
        const [mobile, ...mobileRest] = overridesWith(
            readOxlintConfig('apps/mobile/.oxlintrc.json'),
            RULE,
        )

        expect([...rootRest, ...mobileRest]).toEqual([])
        expect(root.files).toEqual([
            'packages/*/src/**',
            'extensions/*/src/**',
            'apps/browser/src/**',
        ])
        expect(root.rules[RULE]).toBe('error')
        expect(root.excludeFiles).toContain('**/__tests__/**')
        expect(mobile.files).toEqual(['src/**'])
        expect(mobile.rules[RULE]).toBe('error')
        expect(mobile.excludeFiles).toContain('src/**/__tests__/**')
    })
})

function wrap(inner: Node) {
    return { fetch: inner, root: inner }
}

function timeoutAround(inner: Node, helper = 'withTimeout') {
    return {
        fetch: inner,
        root: call(id(helper), [inner, id('ms'), str('op')]),
    }
}
