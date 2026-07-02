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

import { makeStyles } from '@rneui/themed'
import { Platform } from 'react-native'

// PWText disables Android's font padding globally, which clips glyph descenders
// (g, y, p) on the final line of a multi-line/centered message. Re-enable it
// for the empty-state text so descenders aren't cut off. Computed inside
// `makeStyles` (render time) rather than at module scope so importing this file
// never evaluates `Platform.select` at import time.
export const useStyles = makeStyles(theme => ({
    container: {
        flex: 1,
        paddingHorizontal: theme.spacing.xl,
        width: '100%',
        minWidth: 0,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.xl,
        width: '100%',
        minWidth: 0,
    },
    iconContainer: {
        width: theme.spacing['4xl'],
        height: theme.spacing['4xl'],
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: theme.spacing.xxl,
        backgroundColor: theme.colors.layerGrayLighter,
    },
    text: {
        color: theme.colors.textMain,
        textAlign: 'center',
        width: '100%',
        minWidth: 0,
        ...Platform.select({ android: { includeFontPadding: true } }),
    },
    titleText: {
        color: theme.colors.textMain,
        textAlign: 'center',
        width: '100%',
        minWidth: 0,
        ...Platform.select({ android: { includeFontPadding: true } }),
    },
}))
