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

import { PWButton, PWFlatList, PWScreen } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { AssetRowSkeleton } from '@modules/assets'
import { TokenApprovalRow } from './TokenApprovalRow'
import {
    useTokenApprovalsScreen,
    type TokenApprovalItem,
} from './useTokenApprovalsScreen'

const SKELETON_ROWS = 6

export const TokenApprovalsScreen = () => {
    const { t } = useLanguage()
    const {
        scope,
        items,
        isPending,
        isError,
        canRevoke,
        revokingId,
        handleRevoke,
        handleRetry,
    } = useTokenApprovalsScreen()

    const renderItem = ({ item }: { item: TokenApprovalItem }) => (
        <TokenApprovalRow
            item={item}
            scope={scope}
            canRevoke={canRevoke}
            isRevoking={revokingId === item.id}
            isRevokeDisabled={revokingId !== null && revokingId !== item.id}
            onRevoke={handleRevoke}
        />
    )

    const renderEmpty = () => {
        if (isPending) return <AssetRowSkeleton count={SKELETON_ROWS} />
        if (isError) {
            return (
                <EmptyView
                    title={t('token_approvals.error_title')}
                    body={t('token_approvals.error_body')}
                    button={
                        <PWButton
                            variant='secondary'
                            title={t('common.retry.label')}
                            onPress={handleRetry}
                            testID='token_approvals_retry'
                        />
                    }
                />
            )
        }
        return (
            <EmptyView
                title={t('token_approvals.empty_title')}
                body={t('token_approvals.empty_body')}
            />
        )
    }

    return (
        <PWScreen
            testID='token_approvals_screen'
            scroll='never'
        >
            <PWFlatList
                data={items}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                ListEmptyComponent={renderEmpty()}
            />
        </PWScreen>
    )
}
