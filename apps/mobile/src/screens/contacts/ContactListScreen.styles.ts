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

export const useStyles = makeStyles(theme => {
  return {
    container: {
      backgroundColor: theme.colors.background
    },
    flex: {
      flex: 1
    },
    sectionHeader: {
      color: theme.colors.textGray,
      borderBottomColor: theme.colors.layerGrayLighter,
      borderBottomWidth: 1,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.sm,
      marginBottom: theme.spacing.xs
    },
    contactContainer: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      alignItems: 'center',
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.sm
    },
    contactName: {},
    search: {
      borderRadius: theme.spacing.lg,
      paddingHorizontal: theme.spacing.xs
    },
    empty: {
      marginTop: theme.spacing.xl,
      flex: 1,
      backgroundColor: 'red',
      alignItems: 'center',
      justifyContent: 'center'
    }
  };
});
