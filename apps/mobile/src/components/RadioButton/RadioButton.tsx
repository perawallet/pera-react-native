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

import { Text } from '@rneui/themed'
import PWTouchableOpacity from '../PWTouchableOpacity'
import { useStyles } from './styles'
import PWView from '../PWView'

type RadioButtonProps = {
    onPress: () => void
    title: string
    selected: boolean
}
const RadioButton = ({ onPress, title, selected }: RadioButtonProps) => {
    const styles = useStyles()

    return (
        <PWTouchableOpacity
            onPress={onPress}
            style={styles.row}
        >
            <Text>{title}</Text>
            <PWView style={styles.radioContainer}>
                {selected && <PWView style={styles.selectedRadio} />}
            </PWView>
        </PWTouchableOpacity>
    )
}

export default RadioButton
