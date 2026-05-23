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

const AMOUNT_LINE_HEIGHT = 40

export const useStyles = makeStyles(theme => {
    const h1 = {
        fontSize: theme.spacing.xxl,
        lineHeight: AMOUNT_LINE_HEIGHT,
    }
    const amount = {
        color: theme.colors.textMain,
        alignSelf: 'center' as const,
    }
    const amountPlaceholder = {
        color: theme.colors.textGrayLighter,
        alignSelf: 'center' as const,
    }
    return {
        contentContainer: {
            justifyContent: 'flex-start' as const,
            alignItems: 'center' as const,
            gap: theme.spacing.lg,
        },
        h1,
        mainContentContainer: {
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            gap: theme.spacing.lg,
            width: '100%' as const,
        },
        amount,
        amountPlaceholder,
        buttonContainer: {
            flexDirection: 'row',
            justifyContent: 'flex-start',
            alignItems: 'center',
            gap: theme.spacing.md,
            marginBottom: theme.spacing.lg,
            paddingHorizontal: theme.spacing.lg,
        },
        assetDisplay: {
            borderColor: theme.colors.layerGrayLighter,
            borderWidth: theme.borders.sm,
            borderRadius: theme.spacing.xs,
            padding: theme.spacing.md,
            marginHorizontal: theme.spacing.lg,
        },
        nextButton: {
            width: 'auto',
            alignSelf: 'stretch',
            marginHorizontal: theme.spacing.lg,
        },
        secondaryButton: {
            paddingVertical: theme.spacing.xs,
            backgroundColor: theme.colors.background,
            borderWidth: theme.borders.sm,
            borderColor: theme.colors.layerGrayLighter,
            borderRadius: theme.spacing.xs,
        },
        numpadContainer: {
            paddingHorizontal: theme.spacing.xl,
        },
        accountDisplay: {
            flexDirection: 'row',
            gap: theme.spacing.sm,
            alignItems: 'center',
        },
        headerTitleContainer: {
            alignItems: 'center',
        },
    }
})
