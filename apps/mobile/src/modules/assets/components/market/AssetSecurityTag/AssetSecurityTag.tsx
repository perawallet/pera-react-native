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

import { PWIcon, PWText, PWTouchableOpacity } from '@components/core'
import { type IconName } from '@components/core/PWIcon/constants'
import { useStyles } from './styles'

export type AssetSecurityTagVariant = 'neutral' | 'warning'

export type AssetSecurityTagProps = {
    iconName: IconName
    label: string
    variant: AssetSecurityTagVariant
    onPress: () => void
    testID?: string
}

export const AssetSecurityTag = ({
    iconName,
    label,
    variant,
    onPress,
    testID,
}: AssetSecurityTagProps) => {
    const styles = useStyles({ variant })

    const content = (
        <>
            <PWIcon
                name={iconName}
                size='sm'
                variant={variant === 'warning' ? 'negative' : 'secondary'}
            />
            <PWText
                style={styles.label}
                variant='caption'
                weight={500}
            >
                {label}
            </PWText>
        </>
    )

    return (
        <PWTouchableOpacity
            style={styles.container}
            onPress={onPress}
            testID={testID}
        >
            {content}
        </PWTouchableOpacity>
    )
}
