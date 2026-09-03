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

type StyleProps = { height: number; insets: EdgeInsets }

export const useStyles = makeStyles(
    (theme, { height, insets }: StyleProps) => ({
        background: {
            backgroundColor: 'transparent',
        },
        innerContainer: {
            flex: 1,
            height,
        },
        gradient: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
        },
        webview: {
            flex: 1,
            backgroundColor: 'transparent',
        },
        webviewContainer: {
            flex: 1,
            backgroundColor: 'transparent',
        },
        closeButton: {
            position: 'absolute',
            top: insets.top + theme.spacing.lg,
            left: theme.spacing.lg,
            zIndex: theme.zIndex.max,
            width: theme.spacing.xxl,
            height: theme.spacing.xxl,
            borderRadius: theme.borderRadius.full,
            alignItems: 'center',
            justifyContent: 'center',
        },
        loadingOverlay: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
        },
    }),
)
