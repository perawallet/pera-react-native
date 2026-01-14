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

import PWButton from '@components/PWButton'
import EmptyView from '@components/EmptyView'
import PWView from '@components/PWView'
import {
    Arc60SignRequest,
    useSigningRequest,
} from '@perawallet/wallet-core-blockchain'
import { logger } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/language'

type Arc60SigningViewProps = {
    request: Arc60SignRequest
}

//TODO implement me
const Arc60SigningView = ({ request }: Arc60SigningViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { removeSignRequest } = useSigningRequest()

    const signAndSend = () => {
        logger.warn('Arc60 signing not implemented yet', request)
        removeSignRequest(request)
    }

    const rejectRequest = () => {
        removeSignRequest(request)
        if (request.transport === 'callback') {
            request.reject?.()
        }
    }

    return (
        <PWView style={styles.container}>
            <EmptyView
                title={t('common.not_implemented.title')}
                body={t('common.not_implemented.body')}
            />
            <PWView style={styles.buttonContainer}>
                <PWButton
                    title={t('common.cancel.label')}
                    variant='secondary'
                    onPress={rejectRequest}
                    style={styles.button}
                />
                <PWButton
                    title={t('common.confirm.label')}
                    variant='primary'
                    onPress={signAndSend}
                    style={styles.button}
                />
            </PWView>
        </PWView>
    )
}

export default Arc60SigningView
