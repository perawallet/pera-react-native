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

import { makeStyles } from '@rneui/themed'
import type { EdgeInsets } from 'react-native-safe-area-context'

type StyleProps = {
    insets: EdgeInsets
    isFull: boolean
    maxDynamicContentSize?: number
}

export const useStyles = makeStyles(
    (theme, { insets, isFull, maxDynamicContentSize }: StyleProps) => ({
        background: {
            backgroundColor: theme.colors.background,
            borderTopStartRadius: isFull ? 0 : theme.spacing.xl,
            borderTopEndRadius: isFull ? 0 : theme.spacing.xl,
        },
        backdrop: {
            backgroundColor: theme.colors.backdropModalBg,
        },
        handleIndicator: {
            backgroundColor: theme.colors.layerGray,
            width: theme.spacing.xxl,
        },
        // maxHeight caps auto sheets so content scrolls once it hits the cap.
        contentWrapper: {
            flex: 1,
            paddingTop: isFull ? insets.top : 0,
            maxHeight: maxDynamicContentSize,
        },
        innerContainer: {
            flexGrow: 1,
            paddingBottom: isFull ? theme.spacing.md : 0,
        },
        // Fills the fixed-height sheet so KeyboardAvoidingView (behavior:
        // 'height') can shrink it to the space above the keyboard.
        keyboardAvoider: {
            flex: 1,
        },
        hidden: {
            display: 'none',
        },
    }),
)
