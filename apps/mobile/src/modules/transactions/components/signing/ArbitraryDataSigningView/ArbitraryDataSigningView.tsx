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
    PWButton,
    PWIcon,
    PWImage,
    PWTabView,
    PWText,
    PWView,
} from '@components/core'
import {
    ArbitraryDataSignRequest,
    PeraArbitraryDataMessage,
    SignRequestSource,
} from '@perawallet/wallet-core-blockchain'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import {
    useAllAccounts,
    useFindAccountByAddress,
} from '@perawallet/wallet-core-accounts'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { useWebView } from '@hooks/usePeraWebviewInterface'
import { v7 as uuid } from 'uuid'
import { useArbitraryDataSigningView } from '@modules/transactions/hooks/signing/useArbitraryDataSigningView'
import { ArbitraryDataSigningDetailsView } from './ArbitraryDataSigningDetailsView'
import { useState } from 'react'

export type ArbitraryDataSigningViewProps = {
    request: ArbitraryDataSignRequest
}

const SourceMetadataView = ({ metadata }: { metadata: SignRequestSource }) => {
    const styles = useStyles()
    const preferredIcon =
        metadata.icons?.find(
            icon =>
                icon.endsWith('.png') ||
                icon.endsWith('.jpg') ||
                icon.endsWith('.jpeg'),
        ) ?? metadata.icons?.at(0)
    const { pushWebView } = useWebView()

    const handlePressUrl = () => {
        if (!metadata.url) return
        pushWebView({ id: uuid(), url: metadata.url })
    }

    return (
        <PWView style={styles.metadataContainer}>
            {preferredIcon ? (
                <PWImage
                    source={{ uri: preferredIcon }}
                    style={styles.metadataIcon}
                />
            ) : (
                <PWView style={styles.metadataIconContainer}>
                    <PWIcon
                        name='wallet-connect'
                        variant='secondary'
                        size='lg'
                    />
                </PWView>
            )}
            <PWView style={styles.metadataTitleContainer}>
                <PWText
                    variant='h3'
                    style={styles.title}
                >
                    {metadata.name}
                </PWText>
                {!!metadata.url && (
                    <PWButton
                        variant='link'
                        onPress={handlePressUrl}
                        title={metadata.url}
                    />
                )}
            </PWView>
        </PWView>
    )
}

const SingleSignRequestView = ({
    request,
    onDetailsPress,
}: {
    request: PeraArbitraryDataMessage
    onDetailsPress: (message: PeraArbitraryDataMessage) => void
}) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const account = useFindAccountByAddress(request.signer)

    const handleDetailsPress = () => {
        onDetailsPress(request)
    }

    return (
        <PWView style={styles.bodyInnerContainer}>
            <PWView style={styles.messageContainer}>
                <PWText
                    variant='h1'
                    style={styles.body}
                >
                    {t('signing.arbitrary_data_view.body')}
                </PWText>
                <PWText style={styles.message}>{request.message}</PWText>
                {!!account && (
                    <PWView style={styles.accountContainer}>
                        <PWText style={styles.onBehalfOf}>
                            {t('signing.arbitrary_data_view.on_behalf_of')}
                        </PWText>
                        <AccountDisplay
                            account={account}
                            showChevron={false}
                        />
                    </PWView>
                )}
            </PWView>
            <PWView style={styles.detailsContainer}>
                <PWButton
                    title={t('signing.arbitrary_data_view.show_details')}
                    variant='link'
                    paddingStyle='dense'
                    onPress={handleDetailsPress}
                />
            </PWView>
        </PWView>
    )
}

const MultipleSignRequestView = ({
    requests,
    onDetailsPress,
}: {
    requests: PeraArbitraryDataMessage[]
    onDetailsPress: (message: PeraArbitraryDataMessage) => void
}) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const accounts = useAllAccounts()
    return (
        <PWView style={styles.multiBodyInnerContainer}>
            {requests.map((request, index) => (
                <PWView
                    key={index}
                    style={styles.requestContainer}
                >
                    <AccountDisplay
                        account={accounts.find(
                            account => account.address === request.signer,
                        )}
                        showChevron={false}
                    />
                    <PWText
                        variant='h3'
                        style={styles.body}
                    >
                        {t('signing.arbitrary_data_view.body')}
                    </PWText>
                    <PWText style={styles.message}>{request.message}</PWText>
                    <PWButton
                        title={t('signing.arbitrary_data_view.show_details')}
                        variant='link'
                        paddingStyle='none'
                        onPress={() => onDetailsPress(request)}
                    />
                </PWView>
            ))}
        </PWView>
    )
}

export const ArbitraryDataSigningView = ({
    request,
}: ArbitraryDataSigningViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { approveRequest, rejectRequest, isPending } =
        useArbitraryDataSigningView(request)
    const [index, setIndex] = useState(0)
    const [selectedRequest, setSelectedRequest] = useState(request.data[0])

    const isSingleSignRequest = request.data.length === 1

    const handleBack = () => {
        setIndex(0)
    }

    const handleDetailsPress = (message: PeraArbitraryDataMessage) => {
        setSelectedRequest(message)
        setIndex(1)
    }

    return (
        <PWView style={styles.container}>
            <PWTabView
                value={index}
                onChange={setIndex}
                animationType='spring'
            >
                <PWTabView.Item style={styles.tabItem}>
                    <PWView style={styles.tabItemContainer}>
                        <PWText style={styles.title}>
                            {t('signing.arbitrary_data_view.title')}
                        </PWText>
                        {!!request.sourceMetadata && (
                            <SourceMetadataView
                                metadata={request.sourceMetadata}
                            />
                        )}
                        <PWView style={styles.bodyContainer}>
                            {isSingleSignRequest ? (
                                <SingleSignRequestView
                                    request={request.data[0]}
                                    onDetailsPress={handleDetailsPress}
                                />
                            ) : (
                                <MultipleSignRequestView
                                    requests={request.data}
                                    onDetailsPress={handleDetailsPress}
                                />
                            )}
                        </PWView>
                        <PWView style={styles.buttonContainer}>
                            <PWButton
                                title={t('common.cancel.label')}
                                variant='secondary'
                                onPress={rejectRequest}
                                style={styles.button}
                                isDisabled={isPending}
                            />
                            <PWButton
                                title={
                                    isSingleSignRequest
                                        ? t('common.confirm.label')
                                        : t('common.confirm_all.label')
                                }
                                variant='primary'
                                onPress={approveRequest}
                                style={styles.button}
                                isDisabled={isPending}
                                isLoading={isPending}
                            />
                        </PWView>
                    </PWView>
                </PWTabView.Item>
                <PWTabView.Item style={styles.tabItem}>
                    <ArbitraryDataSigningDetailsView
                        request={request}
                        dataMessage={selectedRequest}
                        onBack={handleBack}
                    />
                </PWTabView.Item>
            </PWTabView>
        </PWView>
    )
}
