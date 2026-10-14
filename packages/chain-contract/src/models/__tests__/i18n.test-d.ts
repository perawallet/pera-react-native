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

import { assertType, describe, expectTypeOf, it } from 'vitest'
import { i18nKey } from '../i18n'
import type { I18nKey } from '../i18n'
import type { LocalizedText } from '../domain'

describe('I18nKey', () => {
    it('rejects a bare string', () => {
        // @ts-expect-error a string must go through i18nKey()
        assertType<I18nKey>('common.back_online')
    })

    it('rejects a bare string as LocalizedText.key', () => {
        // @ts-expect-error a string must go through i18nKey()
        assertType<LocalizedText>({ key: 'common.back_online' })
        assertType<LocalizedText>({ key: i18nKey('common.back_online') })
    })

    it('is made by i18nKey() and widens to string', () => {
        expectTypeOf(i18nKey('a')).toEqualTypeOf<I18nKey>()
        expectTypeOf<I18nKey>().toExtend<string>()
    })
})
