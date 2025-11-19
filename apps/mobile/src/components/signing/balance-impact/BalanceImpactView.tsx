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

import PWView from '../../common/view/PWView'
import { useStyles } from './styles'
import { Text } from '@rneui/themed'
import CurrencyDisplay from '../../currency/currency-display/CurrencyDisplay'
import Decimal from 'decimal.js'
import PWIcon from '../../common/icons/PWIcon'

const AssetImpact = () => {
    const styles = useStyles()

    return (
        <PWView style={styles.itemContainer}>
            <PWIcon
                size='lg'
                name='assets/algo'
            />
            <PWView style={styles.amounts}>
                <CurrencyDisplay
                    currency='ALGO'
                    value={Decimal(200)}
                    precision={2}
                    showSymbol
                    h3
                />
                <CurrencyDisplay
                    currency='USD'
                    value={Decimal(12.74)}
                    precision={2}
                    showSymbol
                    style={styles.secondaryAmount}
                />
            </PWView>
        </PWView>
    )
}

const BalanceImpactView = () => {
    const styles = useStyles()

    return (
        <PWView style={styles.impactContainer}>
            <Text
                h4
                h4Style={styles.impactHeading}
            >
                YOU WILL RECEIVE
            </Text>
            <AssetImpact />
            <AssetImpact />
            <Text
                h4
                h4Style={styles.impactHeading}
            >
                YOU WILL SPEND
            </Text>
            <AssetImpact />
            <AssetImpact />
        </PWView>
    )
}

export default BalanceImpactView
