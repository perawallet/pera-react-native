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
        },
        title: {
            textAlign: 'center',
        },
        titleSection: {
            alignItems: 'center',
            gap: theme.spacing.xl,
        },
        description: {
            textAlign: 'center',
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
        section: {
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.layerGrayLightest,
            paddingVertical: theme.spacing.lg,
            gap: theme.spacing.md,
        },
        data: {
            flexWrap: 'wrap',
            overflow: 'hidden',
        },
        scrollContainer: {
            flexGrow: 1,
        },
    }
})
