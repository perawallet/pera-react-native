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

import { PWText } from '../PWText'
import { PWTouchableOpacity } from '../PWTouchableOpacity'
import { PWView } from '../PWView'

import { useStyles } from './styles'

export type PWRadioButtonProps = {
    onPress: () => void
    title: string
    isSelected: boolean
}
export const PWRadioButton = ({
    onPress,
    title,
    isSelected,
}: PWRadioButtonProps) => {
    const styles = useStyles()

    return (
        <PWTouchableOpacity
            onPress={onPress}
            style={styles.row}
        >
            <PWText>{title}</PWText>
            <PWView
                style={[
                    styles.radioContainer,
                    isSelected && styles.selectedBorder,
                ]}
            >
                {isSelected && <PWView style={styles.selectedRadio} />}
            </PWView>
        </PWTouchableOpacity>
    )
}
