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

import { makeStyles } from '@rneui/themed'
import { PWText, PWTouchableOpacity } from '@components/core'

type ConfigurationChipProps = {
    label: string
    isSelected: boolean
    onPress: () => void
    testID?: string
}

type StyleProps = {
    isSelected: boolean
}

const useChipStyles = makeStyles((theme, { isSelected }: StyleProps) => ({
    container: {
        backgroundColor: isSelected
            ? theme.colors.positiveLighter
            : theme.colors.layerGrayLighter,
        borderRadius: theme.borderRadius.full,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
    },
    label: {
        color: isSelected ? theme.colors.positive : theme.colors.textGray,
    },
}))

export const ConfigurationChip = ({
    label,
    isSelected,
    onPress,
    testID,
}: ConfigurationChipProps) => {
    const styles = useChipStyles({ isSelected })

    return (
        <PWTouchableOpacity
            style={styles.container}
            onPress={onPress}
            testID={testID}
        >
            <PWText
                variant='body'
                style={styles.label}
            >
                {label}
            </PWText>
        </PWTouchableOpacity>
    )
}
