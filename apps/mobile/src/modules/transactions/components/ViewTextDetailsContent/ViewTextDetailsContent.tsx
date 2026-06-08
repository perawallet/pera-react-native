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

import { useCallback, useMemo, useState } from 'react'
import {
    PWChip,
    PWIcon,
    PWSheetLayout,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { SheetHeader } from '@modules/bottom-sheet'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { useClipboard } from '@hooks/useClipboard'

export type ViewTextDetailsContentProps = {
    text: string
    title: string
}

export const ViewTextDetailsContent = ({
    text,
    title,
}: ViewTextDetailsContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { copyToClipboard } = useClipboard()

    const [mode, setMode] = useState<'text' | 'hex' | 'base64'>('text')

    const textToDisplay = useMemo(() => {
        switch (mode) {
            case 'text': {
                return text
            }
            case 'hex': {
                return Buffer.from(text).toString('hex')
            }
            case 'base64': {
                return Buffer.from(text).toString('base64')
            }
        }
    }, [text, mode])

    const copyText = () => {
        void copyToClipboard(textToDisplay)
    }

    const handleSelectText = useCallback(() => setMode('text'), [])
    const handleSelectHex = useCallback(() => setMode('hex'), [])
    const handleSelectBase64 = useCallback(() => setMode('base64'), [])

    return (
        <PWSheetLayout
            header={
                <>
                    <SheetHeader
                        title={title}
                        rightAction={
                            <PWIcon
                                name='copy'
                                variant='secondary'
                                onPress={copyText}
                            />
                        }
                    />
                    <PWView style={styles.buttonContainer}>
                        <PWTouchableOpacity onPress={handleSelectText}>
                            <PWChip
                                title={t('common.text.label')}
                                variant={
                                    mode === 'text' ? 'secondary' : 'outline'
                                }
                                forceUppercase={false}
                                paddingStyle='normal'
                            />
                        </PWTouchableOpacity>
                        <PWTouchableOpacity onPress={handleSelectHex}>
                            <PWChip
                                title={t('common.hex.label')}
                                variant={
                                    mode === 'hex' ? 'secondary' : 'outline'
                                }
                                forceUppercase={false}
                                paddingStyle='normal'
                            />
                        </PWTouchableOpacity>
                        <PWTouchableOpacity onPress={handleSelectBase64}>
                            <PWChip
                                title={t('common.base64.label')}
                                variant={
                                    mode === 'base64' ? 'secondary' : 'outline'
                                }
                                forceUppercase={false}
                                paddingStyle='normal'
                            />
                        </PWTouchableOpacity>
                    </PWView>
                </>
            }
        >
            <PWText>{textToDisplay}</PWText>
        </PWSheetLayout>
    )
}
