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

import {
    PWBadge,
    PWIcon,
    PWImage,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useStyles } from './styles'
import type { SessionSummary } from '../../connected-apps/sessionSummary'
import { formatDatetime } from '@perawallet/wallet-core-shared'

export type ConnectedAppItemProps = {
    summary: SessionSummary
}

export const ConnectedAppItem = ({ summary }: ConnectedAppItemProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()

    const badgeLabel =
        summary.type === 'walletconnect'
            ? t('connected_apps.badge_walletconnect')
            : t('connected_apps.badge_liquidauth')

    const fallbackIcon =
        summary.type === 'walletconnect' ? 'wallet-connect' : 'key'

    const handlePress = () => {
        navigation.navigate(
            'ConnectionDetails',
            summary.type === 'walletconnect'
                ? { type: 'walletconnect', clientId: summary.id }
                : { type: 'liquidauth', sessionId: summary.id },
        )
    }

    return (
        <PWTouchableOpacity
            style={styles.sessionItem}
            onPress={handlePress}
        >
            {summary.icon ? (
                <PWImage
                    source={{ uri: summary.icon }}
                    style={styles.icon}
                />
            ) : (
                <PWView style={styles.iconFallback}>
                    <PWIcon name={fallbackIcon} />
                </PWView>
            )}
            <PWView style={styles.sessionInfo}>
                <PWView style={styles.sessionNameContainer}>
                    <PWText
                        variant='h4'
                        numberOfLines={1}
                        ellipsizeMode='tail'
                        style={styles.sessionName}
                    >
                        {summary.name}
                    </PWText>
                    <PWBadge
                        variant='secondary'
                        value={badgeLabel}
                    />
                </PWView>
                {!!summary.origin && (
                    <PWText
                        variant='caption'
                        style={styles.sessionOrigin}
                        numberOfLines={1}
                    >
                        {summary.origin}
                    </PWText>
                )}
                <PWText
                    variant='caption'
                    style={styles.sessionDate}
                >
                    {summary.lastActiveAt
                        ? t('walletconnect.settings.last_active', {
                              date: formatDatetime(
                                  summary.lastActiveAt,
                                  undefined,
                                  'medium',
                              ),
                          })
                        : t('walletconnect.settings.created_at', {
                              date: formatDatetime(
                                  summary.createdAt ?? new Date(),
                                  undefined,
                                  'medium',
                              ),
                          })}
                </PWText>
                <PWView style={styles.sessionStatusContainer}>
                    <PWBadge
                        variant={summary.connected ? 'positive' : 'secondary'}
                        value={
                            summary.connected
                                ? t('walletconnect.settings.connected')
                                : t('walletconnect.settings.disconnected')
                        }
                    />
                </PWView>
            </PWView>
            <PWIcon
                style={styles.chevron}
                name='chevron-right'
            />
        </PWTouchableOpacity>
    )
}
