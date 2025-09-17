import { makeStyles } from '@rneui/themed';
import { PropsWithChildren } from 'react';

export const useStyles = makeStyles((theme, _: PropsWithChildren) => {
  return {
    mainContainer: {
      flex: 1,
    },
    helperText: {
      color: theme.colors.textGray,
      paddingBottom: theme.spacing.xl * 2,
    },
    walletNameContainer: {
      backgroundColor: theme.colors.layerGrayLighter,
      borderRadius: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
      flexDirection: 'row',
      flexWrap: 'nowrap',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
    },
    nameText: {
      color: theme.colors.textGray,
      alignSelf: 'center',
    },
    finishButton: {
      marginHorizontal: theme.spacing.xl,
    },
    input: {
      marginTop: theme.spacing.sm,
    },
    spacer: {
      flexGrow: 1,
    },
  };
});
