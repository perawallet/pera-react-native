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

import { type SvgProps } from 'react-native-svg'
import { PWBadge, PWIcon, PWTouchableOpacity, PWView } from '@components/core'
import { useStyles } from './styles'
import { useNotificationsIcon } from './useNotificationsIcon'

export type NotificationsIconProps = {} & SvgProps

export const NotificationsIcon = (props: NotificationsIconProps) => {
    const { showCountBadge, showDotBadge, countLabel, goToNotifications } =
        useNotificationsIcon()
    const styles = useStyles()

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
