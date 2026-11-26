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
import { PWButton, PWDivider, PWScreen, PWText, PWView } from '@components/core'
import { AccountDisplay } from '@components/AccountDisplay'
import { AssetAmount } from '@components/AssetAmount'
import { AssetIcon } from '@components/AssetIcon'
import { EmptyView } from '@components/EmptyView'
import { InfoCallout } from '@components/InfoCallout'
import { PreferredAmount } from '@components/PreferredAmount'
import { useLanguage } from '@hooks/useLanguage'
import { AssetNameBadge } from '@modules/assets'
import { ChainLabel } from '@modules/chain-ui/icon'
import { useStyles } from './styles'
import { useTokenRequestDetailScreen } from './useTokenRequestDetailScreen'

export const TokenRequestDetailScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        token,
        scope,
        account,
        isPending,
        isSuspicious,
        imitatedCurrency,
        handleAccept,
        handleReject,
    } = useTokenRequestDetailScreen()

    if (!token) {
        return (
            <EmptyView
                isLoading={isPending}
                title={t('asset_inbox.requests.empty_title')}
                body={t('asset_inbox.requests.empty_body')}
            />
        )
    }

    const { asset, amount, usdPrice } = token

    return (
        <PWScreen
            testID='token_request_detail_screen'
            footer={
                <PWView style={styles.footer}>
                    <PWButton
                        variant='primary'
                        title={t('asset_inbox.token_request.accept')}
                        onPress={handleAccept}
                        testID='token_request_accept'
                    />
                    <PWButton
                        variant='secondary'
                        title={t('asset_inbox.token_request.reject')}
                        onPress={handleReject}
                        testID='token_request_reject'
                    />
                </PWView>
            }
        >
            <PWView style={styles.amountSection}>
                <PWView style={styles.assetPreview}>
                    <AssetIcon
                        chainId={scope.chainId}
                        asset={asset}
                        size='3xl'
                    />
                </PWView>
                <AssetNameBadge
                    name={asset.name ?? asset.unitName ?? ''}
                    verificationTier={asset.peraMetadata?.verificationTier}
                    textStyle={styles.name}
                />
                <AssetAmount
                    chainId={scope.chainId}
                    variant='h2'
                    value={amount}
                    asset={asset}
                />
                {usdPrice !== null && (
                    <PreferredAmount
                        sourceAmount={amount}
                        sourceAssetId={asset.assetId}
                        usdPrice={usdPrice}
                        scope={scope}
                        showSymbol
                        style={styles.secondaryText}
                    />
                )}
            </PWView>

            {isSuspicious && (
                <InfoCallout
                    icon='warning'
                    iconVariant='error'
                    iconSize='sm'
                    titleVariant='bodySemibold'
                    title={t('asset_details.token_warning.suspicious_title')}
                    body={t('asset_details.token_warning.body')}
                    style={styles.callout}
                    testID='token_request_suspicious'
                />
            )}
            {imitatedCurrency !== null && (
                <InfoCallout
                    icon='warning'
                    iconVariant='warning'
                    iconSize='sm'
                    titleVariant='bodySemibold'
                    title={t('asset.imitated_currency.title', {
                        code: imitatedCurrency,
                    })}
                    body={t('asset.imitated_currency.body', {
                        code: imitatedCurrency,
                    })}
                    style={styles.callout}
                    testID='token_request_imitated_currency'
                />
            )}

            <PWView style={styles.detailRow}>
                <PWText style={styles.secondaryText}>
                    {t('asset_inbox.token_request.network')}
                </PWText>
                <ChainLabel chainId={scope.chainId} />
            </PWView>
            <PWDivider />
            {account && (
                <>
                    <PWView style={styles.detailRow}>
                        <PWText style={styles.secondaryText}>
                            {t('messages.claim.account')}
                        </PWText>
                        <AccountDisplay
                            account={account}
                            showChevron={false}
                        />
                    </PWView>
                    <PWDivider />
                </>
            )}

            <PWView style={styles.question}>
                <PWText variant='h4'>
                    {t('asset_inbox.token_request.question')}
                </PWText>
                <PWText style={styles.secondaryText}>
                    {t('asset_inbox.token_request.explanation')}
                </PWText>
            </PWView>
        </PWScreen>
    )
}
