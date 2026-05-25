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

import { PWBadge, PWIcon, PWScrollView, PWText, PWView } from '@components/core'
import { SheetHeader } from '@modules/bottom-sheet'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { useClipboard } from '@hooks/useClipboard'
import { useMemo, useState } from 'react'

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
            case 'text':
                return text
            case 'hex':
                return Buffer.from(text).toString('hex')
            case 'base64':
                return Buffer.from(text).toString('base64')
        }
    }, [text, mode])

    const copyText = () => {
        copyToClipboard(textToDisplay)
    }

    return (
        <PWView style={styles.container}>
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
                <PWBadge
                    variant={mode === 'text' ? 'primary' : 'secondary'}
                    value={t('common.text.label')}
                    textStyle={styles.buttonText}
                    onPress={() => setMode('text')}
                />
                <PWBadge
                    variant={mode === 'hex' ? 'primary' : 'secondary'}
                    value={t('common.hex.label')}
                    textStyle={styles.buttonText}
                    onPress={() => setMode('hex')}
                />
                <PWBadge
                    variant={mode === 'base64' ? 'primary' : 'secondary'}
                    value={t('common.base64.label')}
                    textStyle={styles.buttonText}
                    onPress={() => setMode('base64')}
                />
            </PWView>
            <PWScrollView inBottomSheet>
                <PWText style={styles.noteText}>{textToDisplay}</PWText>
            </PWScrollView>
        </PWView>
    )
}
