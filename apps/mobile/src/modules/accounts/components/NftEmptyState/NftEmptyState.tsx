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

import React from 'react'
import { PWButton } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'

type NftEmptyStateProps = {
    /**
     * Hides the opt-in CTA when omitted. Unsignable accounts can't sign
     * opt-in transactions, so the button would be a dead-end.
     */
    onOptInPress?: () => void
}

export const NftEmptyState = ({ onOptInPress }: NftEmptyStateProps) => {
    const { t } = useLanguage()

    return (
        <EmptyView
            icon='grid-view'
            title={t('account_details.nfts.empty_title')}
            body={t('account_details.nfts.empty_body')}
            button={
                onOptInPress ? (
                    <PWButton
                        title={t('account_details.nfts.empty_optin')}
                        icon='plus'
                        variant='primary'
                        onPress={onOptInPress}
                    />
                ) : undefined
            }
        />
    )
}
