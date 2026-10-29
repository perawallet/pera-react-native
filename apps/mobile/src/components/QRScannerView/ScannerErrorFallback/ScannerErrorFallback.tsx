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

import { useStyles } from '../styles'
import { useLanguage } from '@hooks/useLanguage'
import { EmptyView } from '@components/EmptyView'
import { PWButton, PWView } from '@components/core'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export type ScannerErrorFallbackProps = {
    onRetry: () => void
    onClose: () => void
}

export const ScannerErrorFallback = ({
    onRetry,
    onClose,
}: ScannerErrorFallbackProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { t } = useLanguage()
    return (
        <EmptyView
            style={styles.emptyView}
            title={t('camera.scanner_load_failed.title')}
            body={t('camera.scanner_load_failed.body')}
            button={
                <PWView style={styles.errorActions}>
                    <PWButton
                        variant='primary'
                        title={t('common.retry.label')}
                        onPress={onRetry}
                    />
                    <PWButton
                        variant='secondary'
                        title={t('common.close.label')}
                        onPress={onClose}
                    />
                </PWView>
            }
        />
    )
}
