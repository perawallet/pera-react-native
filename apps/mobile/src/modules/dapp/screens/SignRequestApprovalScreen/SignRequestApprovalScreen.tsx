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

// Authors no signing UI: the hook enqueues into the shared signing pipeline and
// SignRequestView routes off the request's `type`.
import React from 'react'
import { SignRequestView } from '@modules/signing/components/SignRequestView'
import { FullScreenLoadingView } from '@components/FullScreenLoadingView'
import { EmptyView } from '@components/EmptyView'
import { PWButton } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useSignRequestApprovalScreen } from './useSignRequestApprovalScreen.web'
import { useStyles } from './styles'

export const SignRequestApprovalScreen = (): React.JSX.Element => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { isLoading, error, request, dismiss } =
        useSignRequestApprovalScreen()

    if (error) {
        return (
            <EmptyView
                title={t('dapp.sign.error.title')}
                body={error}
                style={styles.errorView}
                button={
                    <PWButton
                        variant='primary'
                        title={t('dapp.sign.error.dismiss')}
                        testID='dapp-sign-error-dismiss'
                        onPress={dismiss}
                    />
                }
            />
        )
    }

    if (isLoading || !request) {
        return <FullScreenLoadingView />
    }

    return <SignRequestView request={request} />
}
