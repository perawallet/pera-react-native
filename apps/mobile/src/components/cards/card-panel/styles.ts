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

import { makeStyles } from '@rneui/themed';
import { PropsWithChildren } from 'react';

export const useStyles = makeStyles((theme, _: PropsWithChildren) => {
  return {
    titleContainer: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    cardContainer: {
      backgroundColor: theme.colors.layerGrayLighter,
      borderRadius: theme.spacing.lg,
    },
    cardHeaderContainer: {
      flexDirection: 'row',
    },
    cardTextContainer: {
      padding: theme.spacing.lg,
      gap: theme.spacing.xl,
      flexDirection: 'column',
      flexGrow: 1,
    },
    cardImageContainer: {
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
    },
    cardSecondaryText: {
      color: theme.colors.textGray,
      marginBottom: theme.spacing.xl,
    },
    cardButtonContainer: {
      padding: theme.spacing.lg,
    },
    icon: {
      color: theme.colors.textMain,
      backgroundColor: theme.colors.layerGrayLighter,
    },
    buttonIcon: {
      color: theme.colors.buttonPrimaryText,
      backgroundColor: theme.colors.primary,
    },
    backgroundImage: {
      marginTop: theme.spacing.lg,
      width: 116,
      height: 124,
    },
  };
});
