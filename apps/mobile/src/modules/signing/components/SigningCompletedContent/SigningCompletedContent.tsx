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

import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useLanguage } from '@hooks/useLanguage'

export type SigningCompletedContentProps = {
    /** Whether the completed request was a transaction (vs arbitrary-data). */
    isTransaction: boolean
}

export const SigningCompletedContent = ({
    isTransaction,
}: SigningCompletedContentProps) => {
    const { t } = useLanguage()

    return (
        <ConfirmActionContent
            icon={isTransaction ? 'info' : 'check'}
            iconVariant={isTransaction ? 'primary' : 'positive'}
            title={
                isTransaction
                    ? t('signing.signing_completed.transaction_title')
                    : t('signing.signing_completed.data_title')
            }
            message={
                isTransaction
                    ? t('signing.signing_completed.transaction_body')
                    : t('signing.signing_completed.data_body')
            }
            confirmLabel={t('common.done')}
        />
    )
}
