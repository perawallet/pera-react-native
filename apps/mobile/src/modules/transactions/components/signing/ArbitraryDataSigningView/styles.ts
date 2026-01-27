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
        container: {
            flex: 1,
            minHeight: 500,
        },
        bodyContainer: {
            flexGrow: 1,
        },
        multiBodyInnerContainer: {
            flexGrow: 1,
            gap: theme.spacing.md,
        },
        bodyInnerContainer: {
            flexGrow: 1,
        },
        message: {},
        body: {},
        title: {
            alignSelf: 'center',
        },
        buttonContainer: {
            flexDirection: 'row',
            gap: theme.spacing.lg,
            alignItems: 'center',
            justifyContent: 'center',
            borderTopWidth: theme.borders.sm,
            borderTopColor: theme.colors.layerGrayLightest,
            paddingVertical: theme.spacing.sm,
        },
        button: {
            flexGrow: 1,
        },
        accountContainer: {
            alignItems: 'center',
            gap: theme.spacing.md,
            marginTop: theme.spacing.xxl,
        },
        messageContainer: {
            flexGrow: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.md,
        },
        metadataContainer: {
            alignItems: 'center',
            marginHorizontal: theme.spacing.xl,
            marginTop: theme.spacing.xxl,
            gap: theme.spacing.xl,
        },
        metadataIcon: {
            width: theme.spacing['4xl'],
            height: theme.spacing['4xl'],
            borderRadius: theme.spacing['4xl'],
        },
        metadataIconContainer: {
            width: theme.spacing['4xl'],
            height: theme.spacing['4xl'],
            borderRadius: theme.spacing['4xl'],
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.colors.layerGrayLighter,
        },
        metadataTitleContainer: {
            alignItems: 'center',
        },
        metadataTitle: {
            textAlign: 'center',
        },
        tabItem: {
            width: '100%',
            padding: theme.spacing.xl,
        },
        tabItemContainer: {
            flex: 1,
            backgroundColor: theme.colors.background,
        },
        detailsContainer: {
            alignItems: 'flex-start',
        },
        onBehalfOf: {
            textAlign: 'center',
        },
        requestContainer: {
            borderColor: theme.colors.layerGrayLightest,
            borderWidth: theme.borders.sm,
            borderRadius: theme.spacing.md,
            padding: theme.spacing.lg,
            alignItems: 'flex-start',
            gap: theme.spacing.md,
        },
    }
})
