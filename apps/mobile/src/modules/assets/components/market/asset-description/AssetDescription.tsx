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

import { useStyles } from './styles'
import ExpandableText from '@components/expandable-text/ExpandableText'
import { Text } from '@rneui/themed'
import PWView from '@components/view/PWView'
import { useLanguage } from '@hooks/language'

type AssetDescriptionProps = {
    description?: string
}

const AssetDescription = ({ description }: AssetDescriptionProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    if (!description) {
        return null
    }

    return (
        <PWView style={styles.container}>
            <Text style={styles.title}>
                {t('asset_details.markets.description')}
            </Text>
            <ExpandableText text={description} />
        </PWView>
    )
}

export default AssetDescription
