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

import { InfoCallout } from '@components/InfoCallout'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export const ExternalTransactionCallout = () => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <InfoCallout
            icon='info'
            iconSize='sm'
            titleVariant='bodySemibold'
            title={t('signing.external_transaction.detail_callout_title')}
            body={t('signing.external_transaction.detail_callout_body')}
            style={styles.container}
        />
    )
}
