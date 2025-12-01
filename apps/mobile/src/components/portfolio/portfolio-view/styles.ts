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

export const useStyles = makeStyles((theme) => {
    return {
        iconBar: {
            paddingVertical: 0,
            paddingHorizontal: theme.spacing.xl,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: theme.spacing.lg,
        },
        valueBar: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingTop: theme.spacing.md,
        },
        secondaryValueBar: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
        },
        valueTitleBar: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
        },
        valueTitle: {
            color: theme.colors.textGray,
        },
        dateDisplay: {
            color: theme.colors.textGray,
            textAlign: 'right',
            flexGrow: 1,
        },
        primaryCurrency: {
            color: theme.colors.textMain,
        },
        webview: {
            flex: 1,
            paddingHorizontal: theme.spacing.xl,
        },
        webviewContent: {
            paddingBottom: theme.spacing.xl,
        },
        chartButton: {
            verticalAlign: 'middle',
            justifyContent: 'center',
            alignItems: 'center',
        },
        chartButtonText: {
            paddingVertical: theme.spacing.xs,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.spacing.md,
            borderWidth: 1,
            borderColor: theme.colors.layerGrayLight,
        },
        chartContainer: {
            gap: theme.spacing.md,
            marginTop: theme.spacing.md,
            marginBottom: theme.spacing.md,
        },
    }
})
