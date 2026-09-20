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

import type { ReactNode } from 'react'
import { PWSheetLayout, PWText, PWView } from '@components/core'
import { PanelButton, type PanelButtonProps } from '@components/PanelButton'
import { SheetHeader } from '@modules/bottom-sheet'
import { useStyles } from './styles'

export type OptionListSheetOption = Omit<
    PanelButtonProps,
    'titleWeight' | 'accessibilityRole'
> & { key: string }

type OptionListSheetProps = {
    testID: string
    title: string
    description: string
    /** Off keeps the description at `bodyLarge`'s own `textMain`. */
    isDescriptionMuted?: boolean
    options: OptionListSheetOption[]
    /** Rendered between the description and the options. */
    children?: ReactNode
}

export const OptionListSheet = ({
    testID,
    title,
    description,
    isDescriptionMuted = true,
    options,
    children,
}: OptionListSheetProps) => {
    const styles = useStyles()

    return (
        <PWSheetLayout
            testID={testID}
            header={
                <SheetHeader
                    testID={`${testID}_header`}
                    title={title}
                    showClose
                />
            }
        >
            <PWView style={styles.body}>
                <PWText
                    variant='bodyLarge'
                    style={isDescriptionMuted ? styles.description : undefined}
                >
                    {description}
                </PWText>
                {children}
                <PWView style={styles.options}>
                    {options.map(({ key, ...option }) => (
                        <PanelButton
                            key={key}
                            {...option}
                            titleWeight='h3'
                            accessibilityRole='button'
                        />
                    ))}
                </PWView>
            </PWView>
        </PWSheetLayout>
    )
}
