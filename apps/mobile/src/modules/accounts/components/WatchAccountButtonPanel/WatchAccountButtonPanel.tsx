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

export type WatchAccountButtonPanelProps = {
    onCopyAddress: () => void
    onShowQR: () => void
    onMore: () => void
}

export const WatchAccountButtonPanel = ({
    onCopyAddress,
    onShowQR,
    onMore,
}: WatchAccountButtonPanelProps) => {
    const themeStyle = useStyles()
    const { t } = useLanguage()

    return (
        <PWView style={themeStyle.container}>
            <RoundButton
                title={t('account_details.watch_button_panel.copy_address')}
                icon='copy'
                variant='primary'
                onPress={onCopyAddress}
                testID='copy_address_button'
            />
            <RoundButton
                title={t('account_details.watch_button_panel.show_qr')}
                icon='qr'
                variant='secondary'
                onPress={onShowQR}
                testID='show_qr_button'
            />
            <RoundButton
                title={t('account_details.watch_button_panel.more')}
                icon='ellipsis'
                variant='secondary'
                onPress={onMore}
                testID='more_button'
            />
        </PWView>
    )
}
