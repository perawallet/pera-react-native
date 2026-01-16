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
    return {
        rootContainer: {
            flex: 1,
            flexDirection: 'column',
            gap: theme.spacing['3xl'],
        },
        headerContainer: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        headerTitle: {
            fontWeight: '600',
            paddingLeft: theme.spacing.xl,
            alignSelf: 'flex-end',
        },
        headerImage: {
            width: 267,
            height: 307,
            resizeMode: 'contain',
        },
        buttonTitle: {
            marginTop: theme.spacing.xl,
            marginBottom: theme.spacing.sm,
            color: theme.colors.textGray,
        },
        mainContainer: {
            backgroundColor: theme.colors.background,
            color: theme.colors.white,
            paddingHorizontal: theme.spacing.xl,
            flexDirection: 'column',
        },
        footerContainer: {
            flex: 1,
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: theme.spacing['3xl'],
        },
        termsAndPrivacyText: {
            textAlign: 'center',
            color: theme.colors.textGray,
        },
        linkText: {
            color: theme.colors.linkPrimary,
        },
        overlayBackdrop: {
            backgroundColor: 'rgba(52, 52, 52, 0.8)',
        },
        overlay: {
            padding: theme.spacing.xl,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.layerGray,
            borderRadius: theme.spacing.lg,
            gap: theme.spacing.md,
        },
    }
})
