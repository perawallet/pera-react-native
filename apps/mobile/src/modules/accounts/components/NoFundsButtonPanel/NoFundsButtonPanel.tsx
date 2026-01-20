/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useStyles } from './styles'
import { PWView } from '@components/core'
import { RoundButton } from '@components/RoundButton'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'

export const NoFundsButtonPanel = () => {
    const themeStyle = useStyles()
    const { t } = useLanguage()
    const { showToast } = useToast()

    const notImplemented = () => {
        showToast({
            title: t('common.not_implemented.title'),
            body: t('common.not_implemented.body'),
            type: 'error',
        })
    }

    return (
        <PWView style={themeStyle.container}>
            <RoundButton
                title={t('account_details.no_balance.buy_algo')}
                icon='algo'
                variant='primary'
                onPress={notImplemented}
            />
            <RoundButton
                title={t('account_details.no_balance.transfer')}
                icon='switch'
                variant='secondary'
                onPress={notImplemented}
            />
            <RoundButton
                title={t('account_details.no_balance.receive')}
                icon='inflow'
                variant='secondary'
                onPress={notImplemented}
            />
        </PWView>
    )
}
