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

export const useStyles = makeStyles(theme => {
    const tipNumber = {
        fontSize: theme.spacing.lg,
        color: theme.colors.textGray,
    }
    return {
        container: {
            padding: theme.spacing.xl,
            borderTopStartRadius: theme.spacing.sm,
            borderTopEndRadius: theme.spacing.sm,
            alignItems: 'center',
        },
        bodyContainer: {
            // Stretch to the full width — the container centers its children,
            // which would otherwise shrink this block to its content width and
            // leave the button/tips not spanning the available space. The
            // container already supplies the xl (24) horizontal gutter, so no
            // padding here (it would double it).
            width: '100%',
        },
        title: {
            marginTop: theme.spacing.lg,
            textAlign: 'center',
        },
        preamble: {
            textAlign: 'center',
            color: theme.colors.textGray,
            marginVertical: theme.spacing.xl,
        },
        postamble: {
            marginVertical: theme.spacing.lg,
        },
        tipsContainer: {
            gap: theme.spacing.xl,
        },
        tip: {
            flexDirection: 'row',
            gap: theme.spacing.lg,
            alignItems: 'center',
        },
        tipNumberContainer: {
            borderRadius: theme.spacing.xxl,
            borderColor: theme.colors.layerGrayLightest,
            borderWidth: theme.borders.sm,
            alignItems: 'center',
            justifyContent: 'center',
            width: theme.spacing.xxl,
            height: theme.spacing.xxl,
        },
        tipNumber,
        tipText: {
            flexWrap: 'wrap',
            flexShrink: 1,
        },
        redText: {
            color: theme.colors.alertNegative,
        },
        link: {
            marginLeft: theme.spacing.xs,
        },
    }
})
