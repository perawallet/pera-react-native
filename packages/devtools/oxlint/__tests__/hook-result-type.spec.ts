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
import {
    hookResultType,
    LEAKY_RESULT_TYPES,
} from '../rules/hook-result-type.js'
import { call, id, type Node } from './helpers.js'

describe('pera/hook-result-type', () => {
    const typeRef = (name: string, ...params: Node[]): Node => ({
        type: 'TSTypeReference',
        typeName: id(name),
        ...(params.length > 0
            ? {
                  typeArguments: {
                      type: 'TSTypeParameterInstantiation',
                      params,
                  },
              }
            : {}),
    })
    const annotation = (typeAnnotation: Node): Node => ({
        type: 'TSTypeAnnotation',
        typeAnnotation,
    })
    const exportedFunction = (name: string, returnType: Node): Node => ({
        type: 'ExportNamedDeclaration',
        declaration: {
            type: 'FunctionDeclaration',
            id: id(name),
            returnType: annotation(returnType),
        },
    })
    const exportedConst = (
        name: string,
        init: Node,
        typeAnnotation?: Node,
    ): Node => ({
        type: 'ExportNamedDeclaration',
        declaration: {
            type: 'VariableDeclaration',
            declarations: [
                {
                    type: 'VariableDeclarator',
                    id:
                        typeAnnotation === undefined
                            ? id(name)
                            : {
                                  ...id(name),
                                  typeAnnotation: annotation(typeAnnotation),
                              },
                    init,
                },
            ],
        },
    })
    const arrow = (returnType: Node): Node => ({
        type: 'ArrowFunctionExpression',
        returnType: annotation(returnType),
    })
    const lintExport = (node: Node) => {
        const report = vi.fn()
        hookResultType.create({ report }).ExportNamedDeclaration(node)
        return report
    }

    it.each(LEAKY_RESULT_TYPES)('reports a hook returning %s', type => {
        expect(
            lintExport(exportedFunction('useThing', typeRef(type))),
        ).toHaveBeenCalledOnce()
    })

    it('reports an arrow hook whose union return leaks the query object', () => {
        const union: Node = {
            type: 'TSUnionType',
            types: [typeRef('UseQueryResult'), { type: 'TSUndefinedKeyword' }],
        }
        expect(
            lintExport(exportedConst('useThing', arrow(union))),
        ).toHaveBeenCalledOnce()
    })

    it.each([
        [
            'a hook with its own result type',
            exportedFunction('useThing', typeRef('UseThingResult')),
        ],
        [
            'a non-hook returning a query result',
            exportedFunction('getThing', typeRef('UseQueryResult')),
        ],
        [
            'a zustand store typed on its variable',
            exportedConst(
                'useThingStore',
                call(id('create'), []),
                typeRef('UseBoundStore', typeRef('StoreApi')),
            ),
        ],
    ])('allows %s', (_label, node) => {
        expect(lintExport(node)).not.toHaveBeenCalled()
    })
})
