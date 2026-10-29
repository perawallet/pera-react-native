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
    return fixer.insertTextBefore(program.body[0], `${declaration}\n\n`)
}
