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

import {
    PWChip,
    PWIcon,
    PWSheetLayout,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { SheetHeader } from '@modules/bottom-sheet'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { useViewTextDetailsContent } from './useViewTextDetailsContent'

export type ViewTextDetailsContentProps = {
    text: string
    title: string
}

export const ViewTextDetailsContent = ({
    text,
    title,
}: ViewTextDetailsContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const {
        mode,
        textToDisplay,
        copyText,
        handleSelectText,
        handleSelectHex,
        handleSelectBase64,
    } = useViewTextDetailsContent({ text })

    return (
        <PWSheetLayout
            header={
                <>
                    <SheetHeader
                        title={title}
                        rightAction={
                            <PWIcon
                                name='copy'
                                variant='secondary'
                                onPress={copyText}
                            />
                        }
                    />
                    <PWView style={styles.buttonContainer}>
                        <PWTouchableOpacity onPress={handleSelectText}>
                            <PWChip
                                title={t('common.text.label')}
                                variant={
                                    mode === 'text' ? 'secondary' : 'outline'
                                }
                                forceUppercase={false}
                                paddingStyle='normal'
                            />
                        </PWTouchableOpacity>
                        <PWTouchableOpacity onPress={handleSelectHex}>
                            <PWChip
                                title={t('common.hex.label')}
                                variant={
                                    mode === 'hex' ? 'secondary' : 'outline'
                                }
                                forceUppercase={false}
                                paddingStyle='normal'
                            />
                        </PWTouchableOpacity>
                        <PWTouchableOpacity onPress={handleSelectBase64}>
                            <PWChip
                                title={t('common.base64.label')}
                                variant={
                                    mode === 'base64' ? 'secondary' : 'outline'
                                }
                                forceUppercase={false}
                                paddingStyle='normal'
                            />
                        </PWTouchableOpacity>
                    </PWView>
                </>
            }
        >
            <PWText>{textToDisplay}</PWText>
        </PWSheetLayout>
    )
}
