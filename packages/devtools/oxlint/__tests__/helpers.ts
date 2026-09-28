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

export type Node = Record<string, unknown>

export const id = (name: string): Node => ({ type: 'Identifier', name })
export const member = (object: Node, property: string): Node => ({
    type: 'MemberExpression',
    computed: false,
    object,
    property: id(property),
})
export const call = (callee: Node, args: Node[]): Node => ({
    type: 'CallExpression',
    callee,
    arguments: args,
})

export type OxlintOverride = {
    files: string[]
    excludeFiles?: string[]
    rules: Record<string, unknown>
}
export type OxlintConfig = { plugins?: string[]; overrides: OxlintOverride[] }

// Config paths resolve from the repo root, which is 4 levels up from __tests__.
export const readOxlintConfig = (path: string): OxlintConfig =>
    JSON.parse(
        readFileSync(join(__dirname, '../../../..', path), 'utf8'),
    ) as OxlintConfig
export const overridesWith = (
    config: OxlintConfig,
    rule: string,
): OxlintOverride[] => config.overrides.filter(o => o.rules[rule] !== undefined)
