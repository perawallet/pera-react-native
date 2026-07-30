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

import { PWScreen } from '@components/core'
import { ScreenHeader } from '@components/ScreenHeader'
import { useLanguage } from '@hooks/useLanguage'
import { AccountPicker } from '@modules/accounts/components/AccountPicker'
import { useRekeyToStandardSelectTargetScreen } from './useRekeyToStandardSelectTargetScreen'

export const RekeyToStandardSelectTargetScreen = () => {
    const { t } = useLanguage()
    const { targets, handleSelect } = useRekeyToStandardSelectTargetScreen()

    return (
        <PWScreen
            scroll='never'
            testID='rekey-to-standard-select-target-screen'
        >
            <ScreenHeader
                title={t('rekey.to_standard.select.title')}
                description={t('rekey.to_standard.select.subtitle')}
            />

            <AccountPicker
                accounts={targets}
                onSelect={handleSelect}
                emptyBody={t('rekey.to_standard.select.empty')}
                rowTestIDPrefix='rekey-target-row'
            />
        </PWScreen>
    )
}
