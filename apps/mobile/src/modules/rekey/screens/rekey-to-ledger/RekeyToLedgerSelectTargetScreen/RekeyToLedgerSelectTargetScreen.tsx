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
import { useRekeyToLedgerSelectTargetScreen } from './useRekeyToLedgerSelectTargetScreen'

export const RekeyToLedgerSelectTargetScreen = () => {
    const { t } = useLanguage()
    const { targets, handleSelect } = useRekeyToLedgerSelectTargetScreen()

    return (
        <PWScreen
            scroll='never'
            testID='rekey-to-ledger-select-target-screen'
        >
            <ScreenHeader
                title={t('rekey.to_ledger.select.title')}
                description={t('rekey.to_ledger.select.subtitle')}
            />

            <AccountPicker
                accounts={targets}
                onSelect={handleSelect}
                emptyBody={t('rekey.to_ledger.select.empty')}
                rowTestIDPrefix='rekey-target-row'
            />
        </PWScreen>
    )
}
