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
import { getFontFamily } from '../../../theme/theme'

export const useStyles = makeStyles(theme => {
    return {
        container: {
            flex: 1,
            justifyContent: 'flex-start',
            alignItems: 'center',
            gap: theme.spacing.lg,
        },
        h1: {
            fontSize: 32,
            lineHeight: 40,
        },
        amount: {
            color: theme.colors.textMain,
            fontFamily: getFontFamily(true, 400),
            alignSelf: 'center',
        },
        amountPlaceholder: {
            color: theme.colors.textGrayLighter,
            fontFamily: getFontFamily(true, 400),
            alignSelf: 'center',
        },
        buttonContainer: {
            flexDirection: 'row',
            justifyContent: 'flex-start',
            alignItems: 'center',
            gap: theme.spacing.md,
            marginBottom: theme.spacing.lg,
        },
        assetDisplay: {
            borderColor: theme.colors.layerGrayLighter,
            borderWidth: 1,
            borderRadius: theme.spacing.xs,
            padding: theme.spacing.md,
        },
        nextButton: {
            width: '100%',
        },
        secondaryButton: {
            paddingVertical: theme.spacing.xs,
            backgroundColor: theme.colors.background,
            borderWidth: 1,
            borderColor: theme.colors.layerGrayLighter,
            borderRadius: theme.spacing.xs,
        },
        secondaryButtonTitle: {
            color: theme.colors.textGray,
            fontWeight: '400',
            fontSize: 12,
        },
        numpadContainer: {
            paddingHorizontal: theme.spacing.xl,
        },
        accountDisplay: {
            flexDirection: 'row',
            gap: theme.spacing.sm,
            alignItems: 'center',
        },
        accountDisplaySubHeading: {
            fontSize: theme.spacing.md,
            marginTop: theme.spacing.xs / 2,
        },
    }
})
