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

type ToastStyleProps = { topInset: number }

export const useToastStyles = makeStyles(
    (theme, { topInset }: ToastStyleProps) => {
        return {
            notifierContainer: {
                zIndex: theme.zIndex.toast,
            },
            baseStyle: {
                zIndex: theme.zIndex.max,
                // Push the toast below the status bar / notch — `topInset` covers
                // the system status-bar height (or safe-area inset on iOS) so the
                // toast doesn't overlap battery / clock / camera cutout.
                marginTop: topInset + theme.spacing.sm,
                borderWidth: theme.borders.none,
            },
            successStyle: {
                backgroundColor: theme.colors.success,
            },
            successStyleText: {
                color: theme.colors.alertContent,
            },
            errorStyle: {
                backgroundColor: theme.colors.alertNegative,
            },
            errorStyleText: {
                color: theme.colors.alertContent,
            },
            infoStyle: {
                backgroundColor: theme.colors.background,
            },
            infoStyleText: {
                color: theme.colors.textMain,
            },
            warningStyle: {
                backgroundColor: theme.colors.warning,
            },
            warningStyleText: {
                color: theme.colors.textMain,
            },
        }
    },
)
