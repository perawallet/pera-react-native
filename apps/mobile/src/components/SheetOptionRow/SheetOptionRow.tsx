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
    type IconName,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useStyles } from './styles'

export type SheetOption = {
    id: string
    icon: IconName
    title: string
    subtitle?: string
    onPress: () => void
    variant?: 'default' | 'destructive'
    disabled?: boolean
}

export type SheetOptionRowProps = {
    option: SheetOption
}

export const SheetOptionRow = ({ option }: SheetOptionRowProps) => {
    const styles = useStyles()
    const isDestructive = option.variant === 'destructive'

    return (
        <PWTouchableOpacity
            testID={`account_option_${option.id}`}
            style={[styles.row, option.disabled && styles.rowDisabled]}
            onPress={option.onPress}
            disabled={option.disabled}
        >
            <PWIcon
                name={option.icon}
                variant={isDestructive ? 'error' : 'primary'}
            />
            <PWView style={styles.textContainer}>
                <PWText
                    variant='h4'
                    style={isDestructive ? styles.dangerText : undefined}
                    truncate
                >
                    {option.title}
                </PWText>
                {option.subtitle ? (
                    <PWText
                        variant='body'
                        style={styles.subtitle}
                        numberOfLines={1}
                    >
                        {option.subtitle}
                    </PWText>
                ) : null}
            </PWView>
        </PWTouchableOpacity>
    )
}
