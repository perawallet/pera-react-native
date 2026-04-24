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

const HEADER_IMAGE_WIDTH = 137
const HEADER_IMAGE_HEIGHT = 217

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
        },
        imageContainer: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            position: 'absolute',
            top: 0,
            right: 0,
        },
        headerContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: theme.spacing.xl,
        },
        headerTitle,
        headerImage: {
            width: HEADER_IMAGE_WIDTH,
            height: HEADER_IMAGE_HEIGHT,
            resizeMode: 'contain',
        },
        scrollContent: {
            paddingBottom: theme.spacing['3xl'],
        },
        mainContainer: {
            paddingHorizontal: theme.spacing.lg,
            flexDirection: 'column',
            gap: theme.spacing.md,
        },
        otherOptionsButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            paddingHorizontal: theme.spacing.xl,
            paddingVertical: theme.spacing.lg,
        },
        otherOptionsIconWrapper: {
            backgroundColor: theme.colors.layerGrayLighter,
            borderRadius: theme.spacing.lg,
            padding: theme.spacing.md,
            justifyContent: 'center',
            alignItems: 'center',
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
    }
})
