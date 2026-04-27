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

const HEADER_IMAGE_WIDTH = 267
const HEADER_IMAGE_HEIGHT = 307

export const useStyles = makeStyles(theme => {
    const headerTitle = {
        fontWeight: '600' as const,
        paddingLeft: theme.spacing.xl,
        alignSelf: 'flex-end' as const,
    }
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
        headerTitle,
        headerImage: {
            width: HEADER_IMAGE_WIDTH,
            height: HEADER_IMAGE_HEIGHT,
            resizeMode: 'contain',
        },
        buttonTitle: {
            marginTop: theme.spacing.xl,
            marginBottom: theme.spacing.sm,
            color: theme.colors.textGray,
        },
        mainContainer: {
            backgroundColor: theme.colors.background,
            color: theme.colors.textWhite,
            paddingHorizontal: theme.spacing.xl,
            flexDirection: 'column',
        },
        footerContainer: {
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: theme.spacing['3xl'],
        },
        termsAndPrivacyText: {
            textAlign: 'center',
            color: theme.colors.textGray,
        },
        overlayBackdrop: {
            backgroundColor: theme.colors.backdropModalBg,
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
