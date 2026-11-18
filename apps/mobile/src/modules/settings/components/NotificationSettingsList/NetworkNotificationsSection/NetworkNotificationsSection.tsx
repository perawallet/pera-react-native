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

import type { ReactElement } from 'react'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { PWSwitch, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from '../styles'
import { useNetworkNotificationsSection } from './useNetworkNotificationsSection'

export const NetworkNotificationsSection = (): Nullable<ReactElement> => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        networks,
        isNetworkEnabled,
        isNetworkPending,
        handleNetworkToggle,
    } = useNetworkNotificationsSection()

    if (networks.length === 0) return null

    return (
        <PWView
            style={styles.header}
            testID='settings_notifications_networks'
        >
            <PWText
                variant='caption'
                style={styles.grayText}
                truncate
            >
                {t('settings.notifications.network_notifications')}
            </PWText>
            {networks.map(({ chainId, displayName }) => (
                <PWView
                    key={chainId}
                    style={styles.headerRow}
                >
                    <PWView style={styles.headerLabelContainer}>
                        <PWText
                            variant='body'
                            truncate
                        >
                            {displayName}
                        </PWText>
                    </PWView>
                    <PWView style={styles.switchContainer}>
                        <PWSwitch
                            value={isNetworkEnabled(chainId)}
                            onValueChange={enabled =>
                                handleNetworkToggle(chainId, enabled)
                            }
                            disabled={isNetworkPending(chainId)}
                            testID={`settings_notifications_network_${chainId}`}
                        />
                    </PWView>
                </PWView>
            ))}
        </PWView>
    )
}
