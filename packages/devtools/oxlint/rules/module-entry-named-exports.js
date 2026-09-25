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

export const moduleEntryNamedExports = {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Module entry files name each export',
        },
        messages: {
            star: "export * from '{{source}}' widens this module's contract whenever that file grows: name each export.",
        },
        schema: [],
    },
    create(context) {
        return {
            ExportAllDeclaration(node) {
                context.report({
                    node,
                    messageId: 'star',
                    data: { source: node.source.value },
                })
            },
        }
    },
}
