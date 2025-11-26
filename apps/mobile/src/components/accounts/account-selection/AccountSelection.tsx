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

import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useStyles } from './styles'

import { TouchableOpacity, TouchableOpacityProps } from 'react-native'
import AccountDisplay from '../account-display/AccountDisplay'

type AccountSelectionProps = {} & TouchableOpacityProps

const AccountSelection = (props: AccountSelectionProps) => {
    const styles = useStyles()
    const account = useSelectedAccount()

    //TODO we may want to add support for pending inbox items here too
    //(like the current inbox since we're using the same screen real estate)
    return (
        <TouchableOpacity
            {...props}
            activeOpacity={0.8}
        >
            <AccountDisplay
                account={account ?? undefined}
                style={styles.container}
            />
        </TouchableOpacity>
    )
}

export default AccountSelection
