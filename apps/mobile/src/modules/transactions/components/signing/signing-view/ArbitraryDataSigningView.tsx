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

import PWButton from '@components/button/PWButton'
import EmptyView from '@components/empty-view/EmptyView'
import PWView from '@components/view/PWView'
import {
    ArbitraryDataSignRequest,
    useSigningRequest,
} from '@perawallet/wallet-core-blockchain'
import { logger } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/language'

type ArbitraryDataSigningViewProps = {
    request: ArbitraryDataSignRequest
}

//TODO implement me
const ArbitraryDataSigningView = ({
    request,
}: ArbitraryDataSigningViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { removeSignRequest } = useSigningRequest()

    const signAndSend = () => {
        logger.warn('Arbitrary data signing not implemented yet', request)
        removeSignRequest(request)
    }

    const rejectRequest = () => {
        logger.warn('Arbitrary data signing not implemented yet', request)
        removeSignRequest(request)
    }

    return (
        <PWView style={styles.container}>
            <EmptyView
                title={t('common.not_implemented.title')}
                body={t('common.not_implemented.body')}
            />
            <PWView style={styles.buttonContainer}>
                <PWButton
                    title={t('signing.view.cancel')}
                    variant='secondary'
                    onPress={rejectRequest}
                    style={styles.button}
                />
                <PWButton
                    title={t('signing.view.confirm')}
                    variant='primary'
                    onPress={signAndSend}
                    style={styles.button}
                />
            </PWView>
        </PWView>
    )
}

export default ArbitraryDataSigningView
