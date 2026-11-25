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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { ConnectionPeer } from '@perawallet/wallet-extension-connections'
import { PWLoadingIndicator, PWText, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { InfoCallout } from '@components/InfoCallout'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import { ChainChip } from '@modules/chain-ui/icon'
import { useStyles } from './styles'
import { useWatchAssetContent } from './useWatchAssetContent'

/**
 * `add` approves; `unreadable` closes a sheet for a contract Pera couldn't read
 * as a token; `cancel` is the lone button when the network was down. Cancel
 * resolves nothing.
 */
export type WatchAssetSheetResult = 'add' | 'unreadable' | 'cancel'

export type WatchAssetContentProps = {
    scope: ChainScope
    assetId: string
    accountAddress: string
    peer: ConnectionPeer
}

export const WatchAssetContent = ({
    scope,
    assetId,
    accountAddress,
    peer,
}: WatchAssetContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        asset,
        isLoading,
        isUnreadable,
        isNetworkFailure,
        isSuspicious,
        tierLabel,
        assetLabel,
        truncatedContract,
        chainName,
        peerName,
        peerIconUrl,
    } = useWatchAssetContent({ scope, assetId, peer })

    // A failed read leaves one button: Close for a contract that isn't a token
    // (answers the dApp invalid-params), Cancel when the network was down
    // (answers it as a user cancel, since nothing says the token is bad).
    let message = t('walletconnect.watch_asset.body', { name: peerName })
    let confirmLabel = t(
        isSuspicious
            ? 'add_asset.token.suspicious_confirm'
            : 'walletconnect.watch_asset.confirm',
    )
    let confirmValue: WatchAssetSheetResult = 'add'
    if (isNetworkFailure) {
        message = t('errors.evm.network_unreachable.body')
        confirmLabel = t('common.cancel.label')
        confirmValue = 'cancel'
    } else if (isUnreadable) {
        message = t('walletconnect.watch_asset.unreadable', {
            chain: chainName,
        })
        confirmLabel = t('common.close.label')
        confirmValue = 'unreadable'
    }
    const hasFailed = isNetworkFailure || isUnreadable

    return (
        <ConfirmActionContent<WatchAssetSheetResult>
            icon='globe'
            iconUrl={peerIconUrl}
            title={t('walletconnect.watch_asset.title')}
            message={message}
            confirmLabel={confirmLabel}
            confirmValue={confirmValue}
            confirmVariant={isSuspicious ? 'destructive' : 'primary'}
            isConfirmDisabled={isLoading}
            cancelLabel={hasFailed ? undefined : t('common.cancel.label')}
            testID='watch_asset_sheet'
            confirmTestID='watch_asset_confirm'
        >
            {isLoading && <PWLoadingIndicator />}
            {asset && (
                <PWView style={styles.details}>
                    {isSuspicious && (
                        <InfoCallout
                            icon='warning'
                            iconVariant='error'
                            title={t('add_asset.token.suspicious_title')}
                            body={t('add_asset.token.suspicious_body', {
                                assetName: assetLabel,
                                address: truncatedContract,
                            })}
                        />
                    )}
                    <KeyValueRow title={t('walletconnect.watch_asset.token')}>
                        <PWText variant='body'>{assetLabel}</PWText>
                    </KeyValueRow>
                    <KeyValueRow
                        title={t('walletconnect.watch_asset.verification')}
                    >
                        <PWText variant='body'>{tierLabel}</PWText>
                    </KeyValueRow>
                    <KeyValueRow
                        title={t('walletconnect.watch_asset.contract')}
                        verticalAlignment='top'
                    >
                        <AddressDisplay
                            address={asset.assetId}
                            scope={scope}
                            unnamedAddressFormat='full'
                            showCopy={false}
                            textProps={{ variant: 'body' }}
                        />
                    </KeyValueRow>
                    <KeyValueRow
                        title={t('walletconnect.watch_asset.decimals')}
                    >
                        <PWText variant='body'>{String(asset.decimals)}</PWText>
                    </KeyValueRow>
                    <KeyValueRow title={t('walletconnect.watch_asset.network')}>
                        <ChainChip chainId={scope.chainId} />
                    </KeyValueRow>
                    <KeyValueRow title={t('walletconnect.watch_asset.account')}>
                        <AddressDisplay
                            address={accountAddress}
                            scope={scope}
                            showCopy={false}
                            textProps={{ variant: 'body' }}
                        />
                    </KeyValueRow>
                </PWView>
            )}
        </ConfirmActionContent>
    )
}
