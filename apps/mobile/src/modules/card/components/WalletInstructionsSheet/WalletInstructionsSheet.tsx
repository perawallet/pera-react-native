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

import { useTheme } from '@rneui/themed'
import { PWButton, PWSheetLayout, PWView } from '@components/core'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import AppleWalletIcon from '@assets/icons/apple-wallet.svg'
import GooglePayIcon from '@assets/icons/google-pay.svg'
import { useLanguage } from '@hooks/useLanguage'
import { WalletInstructionStep } from './WalletInstructionStep'
import {
    useWalletInstructionsSheet,
    type WalletPlatform,
} from './useWalletInstructionsSheet'
import { useStyles } from './styles'

type WalletInstructionsSheetProps = {
    platform: WalletPlatform
}

export const WalletInstructionsSheet = ({
    platform,
}: WalletInstructionsSheetProps) => {
    const { t } = useLanguage()
    const { theme } = useTheme()
    const styles = useStyles()
    const { dismiss } = useBottomSheetResult()
    const { title, steps } = useWalletInstructionsSheet(platform)

    // Apple logo is monochrome (themed via color); Google keeps its brand colors.
    const Logo = platform === 'apple' ? AppleWalletIcon : GooglePayIcon

    return (
        <PWSheetLayout
            header={<SheetHeader title={title} />}
            footer={
                <PWButton
                    variant='primary'
                    title={t('peraCard.wallet_instructions.done')}
                    onPress={dismiss}
                    testID='wallet_instructions_done'
                />
            }
            testID='wallet_instructions_sheet'
        >
            <PWView style={styles.body}>
                <Logo
                    width={theme.spacing['3xl']}
                    height={theme.spacing['3xl']}
                    color={theme.colors.textMain}
                    style={styles.logo}
                />
                <PWView style={styles.stepsList}>
                    {steps.map((step, index) => (
                        <WalletInstructionStep
                            key={step}
                            number={index + 1}
                            text={step}
                        />
                    ))}
                </PWView>
            </PWView>
        </PWSheetLayout>
    )
}
