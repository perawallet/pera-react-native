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
    const darkMode = theme.mode === 'dark'
    return {
        drawer: {
            backgroundColor: darkMode
                ? theme.colors.layerGrayLightest
                : theme.colors.background,
            width: '90%',
        },
        iconBar: {
            paddingVertical: 0,
            paddingHorizontal: theme.spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        iconBarSection: {
            flexDirection: 'row',
            gap: theme.spacing.lg,
        },
        accountSelection: {
            borderWidth: 1,
            borderColor: theme.colors.layerGrayLight,
            borderRadius: theme.spacing.xl,
            paddingVertical: theme.spacing.xs,
            paddingHorizontal: theme.spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
        },
        valueBar: {
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.xl * 1.5,
        },
        secondaryValueBar: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        valueTitleBar: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            paddingTop: theme.spacing.xl,
        },
        valueTitle: {
            color: theme.colors.textGray,
        },
        dateDisplay: {
            color: theme.colors.textGray,
            textAlign: 'left',
        },
        primaryCurrency: {
            color: theme.colors.textMain,
        },
        scrollView: {
            flex: 1,
            paddingHorizontal: theme.spacing.xl,
        },
        scrollViewContent: {
            paddingBottom: theme.spacing.xl,
            flex: 1,
        },
        scannerClose: {
            marginTop: theme.spacing.xl * 1.5,
            marginLeft: theme.spacing.lg,
            width: theme.spacing.xl * 2,
            height: theme.spacing.xl * 2,
            alignItems: 'center',
            justifyContent: 'center',
        },
        tabs: {
            paddingTop: theme.spacing.sm,
        },
        fullWidth: {
            width: '100%',
        },
        tabItem: {
            color: theme.colors.textMain,
        },
        indicator: {
            backgroundColor: theme.colors.textMain,
        },
    }
})
