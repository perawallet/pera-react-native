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

// lanekeep-ignore-next-line pera/no-numeric-sizes reason: scan button min height (40)
const SCAN_BUTTON_HEIGHT = 40

export const useStyles = makeStyles(theme => {
    // lanekeep-ignore-next-line pera/no-numeric-sizes reason: centre of the xxl wallet circle
    const connectorIndent = theme.spacing.xxl / 2

    return {
        card: {
            borderWidth: theme.borders.sm,
            borderColor: theme.colors.layerGray,
            borderRadius: theme.borderRadius.lg,
            padding: theme.spacing.md,
            gap: theme.spacing.md,
        },
        infoRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: theme.spacing.md,
            minWidth: 0,
        },
        accountTypeRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
        },
        infoRowValue: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            flex: 1,
            minWidth: 0,
        },
        accountTypeBlock: {
            flex: 1,
            minWidth: 0,
        },
        accountTypeMainRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            minWidth: 0,
        },
        accountTypeText: {
            flexShrink: 1,
        },
        accountTypeQualifier: {
            color: theme.colors.textGray,
        },
        labelText: {
            color: theme.colors.textGray,
        },
        toggleSection: {
            gap: theme.spacing.md,
            alignItems: 'center',
        },
        toggleDivider: {
            width: '100%',
        },
        toggleButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
        },
        toggleText: {
            color: theme.colors.textGray,
        },
        treeContainer: {
            gap: theme.spacing.lg,
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.md,
        },
        walletRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.lg,
        },
        walletInfo: {
            flex: 1,
        },
        walletSubtitle: {
            color: theme.colors.textGray,
        },
        treeRow: {
            gap: theme.spacing.sm,
        },
        walletCircle: {
            width: theme.spacing.xxl,
            height: theme.spacing.xxl,
            borderRadius: theme.borderRadius.full,
            backgroundColor: theme.colors.layerGrayLighter,
            alignItems: 'center',
            justifyContent: 'center',
        },
        connectorContainer: {
            position: 'relative',
            alignSelf: 'stretch',
            width: connectorIndent + theme.spacing.xl,
        },
        connectorVertical: {
            position: 'absolute',
            top: 0,
            left: connectorIndent,
            width: theme.borders.sm,
            bottom: -theme.spacing.lg,
            backgroundColor: theme.colors.layerGray,
        },
        connectorVerticalLast: {
            bottom: undefined,
            height: '50%',
        },
        connectorHorizontal: {
            position: 'absolute',
            top: '50%',
            left: connectorIndent,
            width: theme.spacing.lg,
            height: theme.borders.sm,
            backgroundColor: theme.colors.layerGray,
        },
        accountRow: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.lg,
        },
        accountRowWithConnector: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        accountInfo: {
            flex: 1,
            minWidth: 0,
        },
        accountInfoWithChains: {
            flex: 1,
            minWidth: 0,
            gap: theme.spacing.xxs,
        },
        addressText: {
            color: theme.colors.textGrayLighter,
        },
        chevronExpanded: {
            transform: [{ rotate: '180deg' }],
        },
        addressPanelRow: {
            flexDirection: 'row',
        },
        // Carries the tree's line past an open panel down to the next row.
        connectorSpine: {
            position: 'absolute',
            top: -theme.spacing.sm,
            bottom: -theme.spacing.lg,
            left: connectorIndent,
            width: theme.borders.sm,
            backgroundColor: theme.colors.layerGray,
        },
        addressPanel: {
            flex: 1,
        },
        scanButton: {
            backgroundColor: theme.colors.buttonSquareBg,
            borderRadius: theme.borderRadius.sm,
            // Longer translations wrap; the pill grows with the label.
            minHeight: SCAN_BUTTON_HEIGHT,
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.xs,
            marginLeft: connectorIndent + theme.spacing.xl,
        },
        scanButtonText: {
            flexShrink: 1,
            color: theme.colors.buttonSquareIcon,
        },
        rekeyedSection: {
            gap: theme.spacing.sm,
            paddingBottom: theme.spacing.md,
        },
        rekeyedRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
        },
        rekeyedAddressTouchable: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xxs,
            flexShrink: 1,
            flexGrow: 0,
        },
        rekeyedRowText: {
            flexShrink: 1,
        },
        rekeyedSubtitle: {
            color: theme.colors.textGrayLighter,
        },
        rekeyedUndo: {
            marginLeft: 'auto',
        },
        rekeyedUndoLink: {
            color: theme.colors.positive,
        },
    }
})
