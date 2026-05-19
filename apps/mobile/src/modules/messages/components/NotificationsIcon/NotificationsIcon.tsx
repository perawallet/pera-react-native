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

import { useInboxStatus, useInboxQuery } from '@perawallet/wallet-core-messages'
import { SvgProps } from 'react-native-svg'
import { PWBadge, PWIcon, PWTouchableOpacity, PWView } from '@components/core'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useStyles } from './styles'

export type NotificationsIconProps = {} & SvgProps

const MAX_INBOX_COUNT_DISPLAY = 9

export const NotificationsIcon = (props: NotificationsIconProps) => {
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { hasUnreadNotifications } = useInboxStatus()
    const { data: inboxData } = useInboxQuery()
    const styles = useStyles()

    const goToNotifications = () => {
        navigation.navigate('Messages')
    }

    const inboxCount = inboxData?.length ?? 0
    const showCountBadge = inboxCount > 0
    const showDotBadge = !showCountBadge && hasUnreadNotifications
    const countLabel =
        inboxCount > MAX_INBOX_COUNT_DISPLAY
            ? `${MAX_INBOX_COUNT_DISPLAY}+`
            : String(inboxCount)

    return (
        <PWTouchableOpacity
            onPress={goToNotifications}
            testID='notifications_icon'
        >
            <PWView>
                <PWIcon
                    name='inbox'
                    {...props}
                />
                {showCountBadge && (
                    <PWView
                        style={styles.countBadgePosition}
                        testID='notification-count-badge'
                    >
                        <PWBadge
                            variant='alert'
                            value={countLabel}
                        />
                    </PWView>
                )}
                {showDotBadge && (
                    <PWView
                        style={styles.badge}
                        testID='notification-badge'
                    />
                )}
            </PWView>
        </PWTouchableOpacity>
    )
}
