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

export const useStyles = makeStyles(theme => {
    const maxText = {
        color: theme.colors.positive,
        lineHeight: theme.spacing.lg,
    }
    return {
        formContainer: {
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.lg,
            gap: theme.spacing.md,
        },
        // Gap between the pay and receive sections (the absolutely-positioned
        // controls row sits on top and is out of flow). Previously baked into
        // the receive card's marginTop, now part of the shared layout.
        //
        // Bleeds past the form's own `lg` inset so the cards sit `sm` from the
        // screen edge, matching Fund — which pads its form by `sm` and adds `lg`
        // back inside each row. Done here rather than by re-padding the whole
        // container so only the amount cards move: the provider row, errors,
        // button and widgets below keep their current alignment, and the
        // controls that overlay the cards keep their inset relative to them.
        amountSections: {
            gap: theme.spacing.xl,
            marginHorizontal: -theme.spacing.sm,
        },
        controlsRow: {
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            transform: [{ translateY: '-50%' }],
            zIndex: theme.zIndex.layer1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: theme.spacing.lg,
        },
        swapDirectionButton: {
            width: theme.spacing['3xl'],
            height: theme.spacing.xxl,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.spacing.xxl,
            borderWidth: theme.borders.sm,
            borderColor: theme.colors.layerGray,
            backgroundColor: theme.colors.background,
        },
        swapDirectionIcon: {
            transform: [{ rotate: '90deg' }],
        },
        maxRow: {
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: theme.spacing.xxl,
            borderWidth: theme.borders.sm,
            borderColor: theme.colors.layerGray,
            backgroundColor: theme.colors.background,
        },
        maxIconContainer: {
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.sm,
            alignItems: 'center',
        },
        maxDivider: {
            width: theme.borders.sm,
            alignSelf: 'stretch',
            backgroundColor: theme.colors.layerGray,
            marginVertical: theme.spacing.sm,
        },
        maxButton: {
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.sm,
            alignItems: 'center',
        },
        maxText,
        swapButton: {
            marginTop: theme.spacing.sm,
        },
        errorContainer: {
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.md,
        },
        errorText: {
            color: theme.colors.negative,
        },
    }
})
