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

import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import {
    useNetworkFundingState,
    type NetworkFundingStateProps,
} from './useNetworkFundingState'

export type { NetworkFundingStateProps }

export const NetworkFundingState = (props: NetworkFundingStateProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        title,
        body,
        canReceive,
        canBuy,
        canSwap,
        handleReceive,
        handleBuy,
        handleSwap,
    } = useNetworkFundingState(props)

    return (
        <PWView
            style={styles.container}
            testID='network_funding_state'
        >
            <PWText
                variant='h3'
                style={styles.text}
            >
                {title}
            </PWText>
            <PWText style={styles.body}>{body}</PWText>
            <PWView style={styles.actions}>
                {canReceive && (
                    <PWButton
                        title={t('asset_details.action_buttons.receive')}
                        icon='inflow'
                        variant='primary'
                        onPress={handleReceive}
                        testID='network_funding_receive_button'
                    />
                )}
                {canBuy && (
                    <PWButton
                        title={t('asset_details.action_buttons.buy')}
                        variant='secondary'
                        onPress={handleBuy}
                        testID='network_funding_buy_button'
                    />
                )}
                {canSwap && (
                    <PWButton
                        title={t('asset_details.action_buttons.swap')}
                        variant='secondary'
                        onPress={handleSwap}
                        testID='network_funding_swap_button'
                    />
                )}
            </PWView>
        </PWView>
    )
}
