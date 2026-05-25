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
            borderTopStartRadius: theme.spacing.sm,
            borderTopEndRadius: theme.spacing.sm,
        },
        // Lets the scroll view yield height so the footer CTA stays pinned when
        // content overflows. `flex: 1` would feed an unbounded height to the
        // dynamically-sized sheet and break its measurement.
        scrollBody: {
            flexShrink: 1,
        },
        scrollContent: {
            alignItems: 'center',
            paddingTop: theme.spacing.xl,
            paddingHorizontal: theme.spacing.xl,
        },
        bodyContainer: {
            width: '100%',
        },
        footer: {
            paddingTop: theme.spacing.lg,
            paddingBottom: theme.spacing.xl,
            paddingHorizontal: theme.spacing.xl,
        },
        title: {
            marginTop: theme.spacing.lg,
            textAlign: 'center',
        },
        preamble: {
            textAlign: 'center',
            color: theme.colors.textGray,
            marginVertical: theme.spacing.lg,
        },
        postamble: {
            marginVertical: theme.spacing.lg,
        },
        tipsContainer: {
            gap: theme.spacing.xl,
            paddingBottom: theme.spacing.xl,
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
