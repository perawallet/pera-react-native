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
import { EdgeInsets } from 'react-native-safe-area-context'

export const useStyles = makeStyles(
    (theme, { insets, isFull }: { insets: EdgeInsets; isFull: boolean }) => ({
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
        contentWrapper: {
            flex: 1,
            paddingTop: isFull ? insets.top : 0,
        },
        innerContainer: {
            flexGrow: 1,
            paddingBottom: (Platform.OS === 'ios' ? insets.bottom : 0) + theme.spacing.md,
        },
        hidden: {
            display: 'none',
        },
    }),
)
