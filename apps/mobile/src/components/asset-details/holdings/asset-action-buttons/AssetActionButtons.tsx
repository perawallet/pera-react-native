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
import PWView from '../../../common/view/PWView'
import RoundButton from '../../../common/round-button/RoundButton'
import PWIcon from '../../../common/icons/PWIcon'

const AssetActionButtons = () => {
    const styles = useStyles()

    return (
        <PWView style={styles.container}>
            <RoundButton
                buttonStyle={styles.blackButton}
                title='Swap'
                icon={
                    <PWIcon
                        name='swap'
                        variant='white'
                    />
                }
                onPress={() => {}}
            />
            <RoundButton
                title='Buy / Sell'
                icon={<PWIcon name='dollar' />}
                onPress={() => {}}
            />
            <RoundButton
                title='Send'
                icon={<PWIcon name='arrow-up' />}
                onPress={() => {}}
            />
            <RoundButton
                title='Receive'
                icon={<PWIcon name='arrow-down' />}
                onPress={() => {}}
            />
        </PWView>
    )
}

export default AssetActionButtons
