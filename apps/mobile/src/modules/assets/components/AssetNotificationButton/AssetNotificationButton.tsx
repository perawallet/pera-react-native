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
import {
    PWRoundIcon,
    PWTouchableOpacity,
    type PWTouchableOpacityProps,
} from '@components/core'

export type AssetNotificationButtonProps = {
    isNotificationsEnabled?: boolean | null
} & PWTouchableOpacityProps

export const AssetNotificationButton = ({
    isNotificationsEnabled,
    onPress,
    ...rest
}: AssetNotificationButtonProps) => {
    const styles = useStyles({ isNotificationsEnabled })

    return (
        <PWTouchableOpacity
            onPress={onPress}
            disabled={isNotificationsEnabled === null}
            {...rest}
        >
            <PWRoundIcon
                icon={isNotificationsEnabled ? 'bell' : 'bell-off'}
                size='sm'
                style={styles.icon}
            />
        </PWTouchableOpacity>
    )
}
