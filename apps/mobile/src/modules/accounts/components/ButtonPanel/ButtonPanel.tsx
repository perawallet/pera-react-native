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

import { useStyles } from './styles'
import { PWView } from '@components/core'
import { RoundButton } from '@components/RoundButton'
import { useLanguage } from '@hooks/useLanguage'
import { useButtonPanel } from './useButtonPanel'

export const ButtonPanel = () => {
    const themeStyle = useStyles()
    const { t } = useLanguage()
    const { handleSwap, handleSend, handleReceive, handleMore } =
        useButtonPanel()

    return (
        <PWView
            style={themeStyle.container}
            testID='button_panel'
        >
            <RoundButton
                title={t('account_details.button_panel.swap')}
                icon='swap'
                variant='primary'
                onPress={handleSwap}
                testID='swap_button'
                style={themeStyle.button}
            />
            <RoundButton
                title={t('account_details.button_panel.send')}
                icon='outflow'
                variant='secondary'
                onPress={handleSend}
                testID='send_button'
                style={themeStyle.button}
            />
            <RoundButton
                title={t('account_details.button_panel.receive')}
                icon='inflow'
                variant='secondary'
                onPress={handleReceive}
                testID='receive_button'
                style={themeStyle.button}
            />
            <RoundButton
                title={t('account_details.button_panel.more')}
                icon='chevron-right'
                variant='secondary'
                onPress={handleMore}
                testID='more_button'
                style={themeStyle.button}
            />
        </PWView>
    )
}
