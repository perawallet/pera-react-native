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

const BRAND = 'I18nKey'

// A cast can bury the brand in a union, a generic argument or a record, so the
// whole target type is walked, not just its outermost reference.
const mentionsBrand = value => {
    if (Array.isArray(value)) return value.some(mentionsBrand)
    if (value === null || typeof value !== 'object') return false
    if (value.type === 'TSTypeReference') {
        const { typeName } = value
        const name =
            typeName.type === 'Identifier' ? typeName.name : typeName.right?.name
        if (name === BRAND) return true
    }
    return Object.keys(value).some(
        key =>
            key !== 'parent' &&
            key !== 'loc' &&
            key !== 'range' &&
            mentionsBrand(value[key]),
    )
}

export const noI18nKeyCast = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Make an I18nKey with i18nKey(), never by casting to it',
        },
        messages: {
            cast: 'Casting to I18nKey skips the check on the key: mint it with i18nKey(‘the.whole.key’), which pera/i18n-key-exists verifies against en.json.',
        },
        schema: [],
    },
    create(context) {
        const check = node => {
            if (mentionsBrand(node.typeAnnotation)) {
                context.report({ node, messageId: 'cast' })
            }
        }
        return {
            TSAsExpression: check,
            TSTypeAssertion: check,
        }
    },
}
