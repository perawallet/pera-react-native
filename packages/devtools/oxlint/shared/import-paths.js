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

// context.filename is absolute or already relative to apps/mobile,
// depending on how oxlint is invoked.
export const fromAppRoot = filename => {
    const at = filename.lastIndexOf('/apps/mobile/')
    return at === -1 ? filename : filename.slice(at + '/apps/mobile/'.length)
}

// `specifier` resolved against the directory of `file`, both relative to
// apps/mobile: `..` pops a segment, `.` is skipped.
export const resolveSibling = (file, specifier) => {
    const segments = file.split('/').slice(0, -1)
    for (const part of specifier.split('/')) {
        if (part === '.' || part === '') continue
        if (part === '..') segments.pop()
        else segments.push(part)
    }
    return segments.join('/')
}

// A string literal, or a template without interpolation.
export const staticSpecifier = node => {
    if (node?.type === 'Literal' && typeof node.value === 'string') {
        return node.value
    }
    if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
        return node.quasis[0]?.value.cooked
    }
    return undefined
}
