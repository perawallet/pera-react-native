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

import {
    PWBadge,
    PWBottomSheet,
    type PWBottomSheetProps,
    PWButton,
    PWIcon,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { useClipboard } from '@hooks/useClipboard'
import { Tab, TabView } from '@rneui/themed'
import { useMemo, useState } from 'react'

export type ViewTextDetailsPanelProps = {
    text: string
    titleKey?: string
    onClose: () => void
} & PWBottomSheetProps

export const ViewTextDetailsPanel = ({
    text,
    isVisible,
    titleKey = 'transactions.common.note',
    onClose,
    ...rest
}: ViewTextDetailsPanelProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { copyToClipboard } = useClipboard()

    const copyText = () => {
        copyToClipboard(textToDisplay)
    }

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

    return (
        <PWBottomSheet
            {...rest}
            isVisible={isVisible}
        >
            <PWView style={styles.container}>
                <PWToolbar
                    left={
                        <PWIcon
                            name='cross'
                            variant='secondary'
                            onPress={onClose}
                        />
                    }
                    center={
                        <PWText variant='h4'>
                            {t(titleKey)}
                        </PWText>
                    }
                    right={
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
                        containerStyle={styles.button}
                        textStyle={styles.buttonText}
                        onPress={() => setMode('text')}
                    />
                    <PWBadge
                        variant={mode === 'hex' ? 'primary' : 'secondary'}
                        value={t('common.hex.label')}
                        containerStyle={styles.button}
                        textStyle={styles.buttonText}
                        onPress={() => setMode('hex')}
                    />
                    <PWBadge
                        variant={mode === 'base64' ? 'primary' : 'secondary'}
                        value={t('common.base64.label')}
                        containerStyle={styles.button}
                        textStyle={styles.buttonText}
                        onPress={() => setMode('base64')}
                    />
                </PWView>
                <PWText style={styles.noteText}>{textToDisplay}</PWText>
            </PWView>
        </PWBottomSheet>
    )
}
