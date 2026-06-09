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

import { useTranslation } from 'react-i18next'

import { PWButton } from '@components/core'
import { EmptyView } from '@components/EmptyView'

type AgeRestrictedFallbackProps = {
    onRetry: () => void
}

export const AgeRestrictedFallback = ({
    onRetry,
}: AgeRestrictedFallbackProps) => {
    const { t } = useTranslation()
    return (
        <EmptyView
            icon='locked'
            title={t('age_gate.restricted.title')}
            body={t('age_gate.restricted.body')}
            button={
                <PWButton
                    variant='primary'
                    testID='age-gate-retry'
                    title={t('age_gate.restricted.retry')}
                    onPress={onRetry}
                />
            }
        />
    )
}
