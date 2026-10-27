/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { Pressable, Text } from 'react-native'
import { styles } from './styles'

type ButtonProps = {
    title: string
    onPress: () => void
    isDisabled?: boolean
}

export const Button = ({ title, onPress, isDisabled = false }: ButtonProps) => (
    <Pressable
        disabled={isDisabled}
        onPress={onPress}
        style={[styles.button, isDisabled && styles.buttonOff]}
    >
        <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
)
