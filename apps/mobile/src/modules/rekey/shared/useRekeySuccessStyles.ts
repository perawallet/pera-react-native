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

export const useRekeySuccessStyles = makeStyles(
    (theme, bottomPadding: number) => ({
        container: {
            flex: 1,
            backgroundColor: theme.colors.background,
        },
        content: {
            flex: 1,
            paddingHorizontal: theme.spacing.xl,
            justifyContent: 'center',
            gap: theme.spacing.xxl,
        },
        iconWrapper: {
            alignItems: 'flex-start',
        },
        textBlock: {
            gap: theme.spacing.md,
        },
        title: {
            textAlign: 'left',
            color: theme.colors.textMain,
        },
        body: {
            color: theme.colors.textGray,
        },
        footer: {
            paddingHorizontal: theme.spacing.xl,
            paddingBottom: bottomPadding,
        },
        cta: {
            paddingVertical: theme.spacing.lg,
        },
    }),
)
