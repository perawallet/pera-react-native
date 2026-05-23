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

const HEADER_IMAGE_HEIGHT = 220

type StyleProps = { screenWidth: number }

export const useStyles = makeStyles((theme, { screenWidth }: StyleProps) => ({
    overlay: {
        width: screenWidth - theme.spacing.lg * 2,
        maxWidth: '100%',
        borderRadius: theme.borderRadius.lg,
        backgroundColor: theme.colors.background,
        padding: 0,
        overflow: 'hidden',
    },
    backdrop: {
        backgroundColor: theme.colors.backdropModalBg,
    },
    container: {
        alignItems: 'center',
        width: '100%',
        minWidth: 0,
        overflow: 'hidden',
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
        width: '100%',
        minWidth: 0,
        marginBottom: theme.spacing.lg,
    },
    title: {
        textAlign: 'center',
        width: '100%',
    },
    bulletContainer: {
        width: '100%',
        gap: theme.spacing.lg,
        marginBottom: theme.spacing['3xl'],
    },
    bulletItem: {
        width: '100%',
        minWidth: 0,
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
        flexShrink: 0,
    },
    numberText: {
        color: theme.colors.textMain,
        textAlign: 'center',
    },
    bulletText: {
        flex: 1,
        minWidth: 0,
        color: theme.colors.textGray,
        paddingTop: theme.spacing.xs,
    },
    continueButton: {
        alignSelf: 'stretch',
        width: '100%',
        minWidth: 0,
    },
}))
