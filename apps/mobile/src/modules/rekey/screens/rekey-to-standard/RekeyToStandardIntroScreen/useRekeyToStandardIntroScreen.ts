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

import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import type { RekeyIntroCopy } from '@modules/rekey/components/RekeyIntroScreen'

const COPY: RekeyIntroCopy = {
    titleKey: i18nKey('rekey.to_standard.intro.title'),
    bodyKey: i18nKey('rekey.to_standard.intro.body'),
    learnMoreKey: i18nKey('rekey.to_standard.intro.learn_more'),
    expectLabelKey: i18nKey('rekey.to_standard.intro.expect_label'),
    ctaKey: i18nKey('rekey.to_standard.intro.cta'),
    expectationKeys: [
        i18nKey('rekey.to_standard.intro.expect_1'),
        i18nKey('rekey.to_standard.intro.expect_2'),
        i18nKey('rekey.to_standard.intro.expect_3'),
        i18nKey('rekey.to_standard.intro.expect_4'),
    ],
}

export type UseRekeyToStandardIntroScreenResult = {
    copy: RekeyIntroCopy
}

export const useRekeyToStandardIntroScreen =
    (): UseRekeyToStandardIntroScreenResult => ({ copy: COPY })
