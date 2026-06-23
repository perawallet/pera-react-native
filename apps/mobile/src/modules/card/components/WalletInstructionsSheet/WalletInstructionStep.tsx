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

import { PWText, PWView } from '@components/core'
import { useStyles } from './styles'

type WalletInstructionStepProps = {
    /** 1-based step number shown in the circle. */
    number: number
    text: string
}

export const WalletInstructionStep = ({
    number,
    text,
}: WalletInstructionStepProps) => {
    const styles = useStyles()

    return (
        <PWView style={styles.step}>
            <PWView style={styles.stepNumber}>
                <PWText
                    variant='footnoteMedium'
                    weight={500}
                    style={styles.stepNumberText}
                >
                    {number}
                </PWText>
            </PWView>
            <PWText
                variant='body'
                style={styles.stepText}
            >
                {text}
            </PWText>
        </PWView>
    )
}
