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

import {
    PWChip,
    type PWChipProps,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useStyles } from './styles'

export type SheetOptionCardProps = {
    title: string
    description: string
    chip?: { label: string; variant?: PWChipProps['variant'] }
    onPress: () => void
    isDisabled?: boolean
    testID: string
}

export const SheetOptionCard = ({
    title,
    description,
    chip,
    onPress,
    isDisabled,
    testID,
}: SheetOptionCardProps) => {
    const styles = useStyles()

    return (
        <PWTouchableOpacity
            onPress={onPress}
            disabled={isDisabled}
            style={[styles.card, isDisabled && styles.cardDisabled]}
            testID={testID}
        >
            <PWView style={styles.content}>
                <PWView style={styles.header}>
                    <PWView style={styles.titleContainer}>
                        <PWText
                            variant='h4'
                            numberOfLines={2}
                            ellipsizeMode='tail'
                        >
                            {title}
                        </PWText>
                    </PWView>
                    {!!chip && (
                        <PWView style={styles.chipContainer}>
                            <PWChip
                                title={chip.label}
                                variant={chip.variant}
                            />
                        </PWView>
                    )}
                </PWView>
                <PWText
                    variant='body'
                    style={styles.description}
                    numberOfLines={3}
                    ellipsizeMode='tail'
                >
                    {description}
                </PWText>
            </PWView>

            <PWView style={styles.rightIconContainer}>
                <PWIcon
                    name='chevron-right'
                    size='sm'
                    variant='secondary'
                />
            </PWView>
        </PWTouchableOpacity>
    )
}
