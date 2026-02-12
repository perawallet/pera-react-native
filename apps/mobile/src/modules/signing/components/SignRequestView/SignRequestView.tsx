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

import { Arc60SignRequest, SignRequest } from '@perawallet/wallet-core-signing'
import { EmptyView } from '@components/EmptyView'
import { Arc60DataSigningView } from '../Arc60DataSigningView'
import { useLanguage } from '@hooks/useLanguage'
import { SigningRoutes } from '@modules/signing/routes'
import {
    NavigationContainer,
    NavigationIndependentTree,
} from '@react-navigation/native'
import { PWView } from '@components/core'
import { useStyles } from './styles'

export type SignRequestViewProps = {
    request: SignRequest
}

export const SignRequestView = ({ request }: SignRequestViewProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    switch (request.type) {
        case 'transactions':
        case 'arbitrary-data':
            return (
                <PWView style={styles.container}>
                    <NavigationIndependentTree>
                        <NavigationContainer>
                            <SigningRoutes request={request} />
                        </NavigationContainer>
                    </NavigationIndependentTree>
                </PWView>
            )
        case 'arc60':
            return (
                <Arc60DataSigningView request={request as Arc60SignRequest} />
            )
        default:
            return (
                <EmptyView
                    title={t('signing.unknown_request_type.title')}
                    body={t('signing.unknown_request_type.body')}
                />
            )
    }
}
