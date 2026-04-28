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
import type { EdgeInsets } from 'react-native-safe-area-context'

const CARD_MAX_WIDTH = 420
const HEADER_IMAGE_HEIGHT = 220

export const useStyles = makeStyles((theme, insets: EdgeInsets) => ({
    overlay: {
        position: 'absolute',
        bottom: insets.bottom,
        left: theme.spacing.lg,
        right: theme.spacing.lg,
        maxWidth: CARD_MAX_WIDTH,
        alignSelf: 'center',
        borderRadius: theme.borderRadius.lg,
        backgroundColor: theme.colors.background,
        padding: 0,
    },
    backdrop: {
        backgroundColor: theme.colors.backdropModalBg,
    },
    container: {
        alignItems: 'center',
        paddingHorizontal: theme.spacing.xl,
        paddingBottom: theme.spacing['3xl'],
    },
    headerImage: {
        alignSelf: 'stretch',
        height: HEADER_IMAGE_HEIGHT,
        marginHorizontal: -theme.spacing.xl,
        marginBottom: theme.spacing.xl,
    },
    titleContainer: {
        alignItems: 'center',
        marginBottom: theme.spacing.lg,
    },
    title: {
        textAlign: 'center',
    },
    bulletContainer: {
        width: '100%',
        gap: theme.spacing.lg,
        marginBottom: theme.spacing['3xl'],
    },
    bulletItem: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.lg,
    },
    numberBadge: {
        width: theme.spacing.xxl,
        height: theme.spacing.xxl,
        borderRadius: theme.borderRadius.full,
        borderWidth: theme.borders.sm,
        borderColor: theme.colors.layerGrayLighter,
        backgroundColor: theme.colors.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    numberText: {
        color: theme.colors.textMain,
        textAlign: 'center',
    },
    bulletText: {
        flex: 1,
        color: theme.colors.textGray,
        paddingTop: theme.spacing.xs,
    },
    continueButton: {
        width: '100%',
    },
}))
