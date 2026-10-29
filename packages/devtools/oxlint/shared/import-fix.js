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

const LICENSE_HEADER = /Copyright|Licensed under/

// `declaration` is one full `import … from '…'` line, without a newline.
// Placement follows the repo's import order: after the last @perawallet/
// import, else ahead of the first relative import, else after the last import.
export const insertImportDeclaration = (fixer, program, declaration) => {
    const imports = program.body.filter(n => n.type === 'ImportDeclaration')
    const text = `\n${declaration}`

    const lastPera = imports.findLast(n =>
        n.source.value.startsWith('@perawallet/'),
    )
    if (lastPera) return fixer.insertTextAfter(lastPera, text)

    const firstRelative = imports.findIndex(n => n.source.value.startsWith('.'))
    if (firstRelative > 0) {
        return fixer.insertTextAfter(imports[firstRelative - 1], text)
    }
    if (firstRelative === 0) {
        return fixer.insertTextBefore(imports[0], `${declaration}\n`)
    }

    if (imports.length > 0) return fixer.insertTextAfter(imports.at(-1), text)

    // A node's range excludes its leading comments, so inserting at the node would
    // detach its doc comment. Land ahead of them, below the license header.
    const first = program.body[0]
    const [header, ...rest] = program.comments.filter(
        c => c.range[1] <= first.range[0],
    )
    const leading =
        header?.type === 'Block' && LICENSE_HEADER.test(header.value)
            ? rest
            : [header, ...rest].filter(Boolean)
    return fixer.insertTextBefore(
        leading[0] ?? first,
        `${declaration}\n\n`,
    )
}
