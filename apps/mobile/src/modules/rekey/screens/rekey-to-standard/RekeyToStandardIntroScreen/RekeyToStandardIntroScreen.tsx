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

import { config } from '@perawallet/wallet-core-config'
import { RekeyIntroScreen } from '../../../components/RekeyIntroScreen'
import { useRekeyToStandardIntroScreen } from './useRekeyToStandardIntroScreen'

export const RekeyToStandardIntroScreen = () => {
    const { i18nBaseKey, titleKey, expectationCount } =
        useRekeyToStandardIntroScreen()

    return (
        <RekeyIntroScreen
            i18nBaseKey={i18nBaseKey}
            titleKey={titleKey}
            testIdPrefix='rekey-to-standard'
            expectationCount={expectationCount}
            navConfig={{
                parentRoute: 'RekeyToStandard',
                selectTargetScreen: 'RekeyToStandardSelectTarget',
                supportUrl: config.rekeyToStandardSupportUrl,
            }}
        />
    )
}
