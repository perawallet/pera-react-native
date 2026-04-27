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

import { PWResultView, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useRekeySuccessScreen } from './useRekeySuccessScreen'
import { useStyles } from './styles'

export const RekeySuccessScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { sourceName, handleDone } = useRekeySuccessScreen()

    return (
        <PWView
            style={styles.container}
            testID='rekey-to-standard-success-screen'
        >
            <PWResultView
                variant='success'
                title={t('rekey.to_standard.success.title')}
                body={t('rekey.to_standard.success.body', {
                    source: sourceName,
                })}
                primaryAction={{
                    label: t('rekey.to_standard.success.cta'),
                    onPress: handleDone,
                }}
                testID='rekey-to-standard-success-view'
            />
        </PWView>
    )
}
