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

import { PWButton, PWScreen, PWSlideToConfirm, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { SourceMetadataView } from '@modules/signing/components/SourceMetadataView'
import { SingleArbitrarySignRequestView } from '@modules/signing/components/SingleArbitrarySignRequestView'
import { MultipleArbitrarySignRequestView } from '@modules/signing/components/MultipleArbitrarySignRequestView'
import { useStyles } from './styles'
import { useArbitraryDataSigningScreen } from './useArbitraryDataSigningScreen'

export const ArbitraryDataSigningScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        request,
        isSingleSignRequest,
        isPending,
        isQuantumBlocked,
        handleApprove,
        handleReject,
        handleDetailsPress,
    } = useArbitraryDataSigningScreen()

    if (!request) return null

    if (isQuantumBlocked) {
        return (
            <PWScreen
                footer={
                    <PWButton
                        title={t('common.close.label')}
                        variant='primary'
                        onPress={handleReject}
                    />
                }
            >
                <PWView
                    style={styles.bodyContainer}
                    testID='arbitrary-data-quantum-blocked'
                >
                    <EmptyView
                        title={t('quantum.data_signing_unsupported.title')}
                        body={t('quantum.data_signing_unsupported.body')}
                    />
                </PWView>
            </PWScreen>
        )
    }

    return (
        <PWScreen
            footer={
                <PWView style={styles.buttonContainer}>
                    <PWSlideToConfirm
                        title={t('common.slide_to_confirm.label')}
                        onConfirm={handleApprove}
                        isLoading={isPending}
                        testID='arbitrary-data-confirm-slide'
                    />
                    <PWButton
                        title={t('common.cancel.label')}
                        variant='linkNeutral'
                        onPress={handleReject}
                        isDisabled={isPending}
                        testID='arbitrary-data-reject-button'
                    />
                </PWView>
            }
        >
            {!!request.sourceMetadata && (
                <SourceMetadataView
                    metadata={request.sourceMetadata}
                    verifiedOrigin={request.verifiedOrigin}
                />
            )}
            <PWView style={styles.bodyContainer}>
                {isSingleSignRequest ? (
                    <SingleArbitrarySignRequestView
                        request={request.data[0]}
                        onDetailsPress={handleDetailsPress}
                    />
                ) : (
                    <MultipleArbitrarySignRequestView
                        requests={request.data}
                        onDetailsPress={handleDetailsPress}
                    />
                )}
            </PWView>
        </PWScreen>
    )
}
