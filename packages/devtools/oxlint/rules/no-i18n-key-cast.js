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

import { mentionsTypeReference } from './type-reference.js'

const BRAND = 'I18nKey'

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
            if (mentionsTypeReference(node.typeAnnotation, BRAND)) {
                context.report({ node, messageId: 'cast' })
            }
        }
        return {
            TSAsExpression: check,
            TSTypeAssertion: check,
        }
    },
}
