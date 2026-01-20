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

import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { EmptyView } from '@components/EmptyView'
import { TransactionIcon } from '@modules/transactions/components/TransactionIcon/TransactionIcon'
import { PWButton, PWText, PWView, bottomSheetNotifier } from '@components/core'
import {
    encodeAlgorandAddress,
    TransactionSignRequest,
    useAlgorandClient,
    useSigningRequest,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import Decimal from 'decimal.js'
import { ScrollView } from 'react-native-gesture-handler'
import { useStyles } from './styles'
import { BalanceImpactView } from '../BalanceImpactView/BalanceImpactView'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useTransactionSigner } from '@perawallet/wallet-core-accounts'
import { config } from '@perawallet/wallet-core-config'

export type TransactionSigningViewProps = {
    request: TransactionSignRequest
}

//TODO: we need to support all tx types here
//TODO: use real data from the TXs
//TODO: convert usd amounts to preferred currency
const SingleTransactionView = ({ request }: TransactionSigningViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const tx = request.txs?.at(0)?.at(0)
    const receiver = tx?.assetTransfer?.receiver ?? tx?.payment?.receiver

    //TODO this isn't really a valid error since it might be an app call or something but that
    //will get fixed when we implement all tx types
    if (!receiver) {
        return (
            <EmptyView
                title={t('signing.transaction_view.invalid_title')}
                body={t('signing.transaction_view.invalid_body')}
            />
        )
    }

    return (
        <PWView style={styles.body}>
            <TransactionIcon
                type='pay'
                size='large'
            />
            <PWText variant='h4'>
                Transfer to{' '}
                {truncateAlgorandAddress(
                    encodeAlgorandAddress(receiver.publicKey),
                )}
            </PWText>
            <CurrencyDisplay
                currency='ALGO'
                precision={3}
                value={Decimal(-5059.44)}
                showSymbol
                h1
                style={styles.mainAmount}
            />
            <CurrencyDisplay
                currency='USD'
                precision={3}
                value={Decimal(-5059.44 * 0.17)}
                showSymbol
                h3
                style={styles.secondaryAmount}
            />
        </PWView>
    )
}

const GroupTransactionView = ({ request }: TransactionSigningViewProps) => {
    const styles = useStyles()
    const isMultipleGroups = request.txs?.length > 1
    return (
        <ScrollView contentContainerStyle={styles.body}>
            <TransactionIcon
                type='group'
                size='large'
            />
            <PWText variant='h4'>
                {isMultipleGroups
                    ? 'Transaction Groups'
                    : `Group ID: ${truncateAlgorandAddress('SomeIDForAGroup')}`}
            </PWText>
            {isMultipleGroups ? (
                <PWView>
                    <PWText>This is where we{"'"}ll show the groups</PWText>
                </PWView>
            ) : (
                <BalanceImpactView />
            )}
        </ScrollView>
    )
}

export const TransactionSigningView = ({
    request,
}: TransactionSigningViewProps) => {
    const styles = useStyles()
    const { removeSignRequest } = useSigningRequest()
    const { signTransactions } = useTransactionSigner()
    const { encodeSignedTransactions } = useTransactionEncoder()
    const algokit = useAlgorandClient()
    const { showToast } = useToast()
    const { t } = useLanguage()
    const isMultipleTransactions = request.txs?.length > 1

    const signAndSend = async () => {
        try {
            const signedTxs = await Promise.all(
                request.txs.map(txs => {
                    return signTransactions(
                        txs,
                        request.txs.map((_, idx) => idx),
                    )
                }),
            )
            if (request.transport === 'algod') {
                signedTxs.forEach(group => {
                    algokit.client.algod.sendRawTransaction(
                        encodeSignedTransactions(group),
                    )
                })
            } else {
                await request.approve?.(signedTxs)
                showToast({
                    title: t('signing.transaction_view.success_title'),
                    body: t('signing.transaction_view.success_body'),
                    type: 'success',
                })
            }
            removeSignRequest(request)
        } catch (error) {
            if (request.transport === 'algod') {
                showToast(
                    {
                        type: 'error',
                        title: t(
                            'signing.transaction_view.transaction_failed_title',
                        ),
                        body: config.debugEnabled
                            ? `${error}`
                            : t(
                                  'signing.transaction_view.transaction_failed_body',
                              ),
                    },
                    {
                        notifier: bottomSheetNotifier.current ?? undefined,
                    },
                )
            } else {
                request.error?.(`${error}`)
            }
        }
    }

    const rejectRequest = () => {
        if (request.transport === 'callback') {
            request.reject?.()
        }
        removeSignRequest(request)
    }

    return (
        <PWView style={styles.container}>
            {isMultipleTransactions ? (
                <GroupTransactionView request={request} />
            ) : (
                <SingleTransactionView request={request} />
            )}
            <PWView style={styles.buttonContainer}>
                <PWButton
                    title={t('common.cancel.label')}
                    variant='secondary'
                    onPress={rejectRequest}
                    style={styles.button}
                />
                <PWButton
                    title={
                        isMultipleTransactions
                            ? t('common.confirm_all.label')
                            : t('common.confirm.label')
                    }
                    variant='primary'
                    onPress={signAndSend}
                    style={styles.button}
                />
            </PWView>
        </PWView>
    )
}
