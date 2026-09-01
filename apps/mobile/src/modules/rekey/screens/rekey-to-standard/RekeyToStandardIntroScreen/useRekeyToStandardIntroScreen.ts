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

import { useIsQuantumAccountsEnabled } from '@hooks/useIsQuantumAccountsEnabled'

import type { RekeyIntroScreenProps } from '../../../components/RekeyIntroScreen'

const I18N_BASE_KEY = 'rekey.to_standard.intro'

export type UseRekeyToStandardIntroScreenResult = {
    i18nBaseKey: string
    titleKey: string
    /** Kept with the keys so the spec can hold the two in sync. */
    expectationCount: RekeyIntroScreenProps['expectationCount']
}

/**
 * The destination is picked on the next screen, so the title has to cover every
 * account type this flow can rekey to. Quantum accounts are only among them
 * while they are visible, hence the flag.
 */
export const useRekeyToStandardIntroScreen =
    (): UseRekeyToStandardIntroScreenResult => {
        const isQuantumTargetEnabled = useIsQuantumAccountsEnabled()

        return {
            i18nBaseKey: I18N_BASE_KEY,
            titleKey: isQuantumTargetEnabled
                ? `${I18N_BASE_KEY}.title_with_quantum`
                : `${I18N_BASE_KEY}.title`,
            expectationCount: 4,
        }
    }
