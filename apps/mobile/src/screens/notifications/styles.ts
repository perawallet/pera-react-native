import { makeStyles } from '@rneui/themed';
import { PropsWithChildren } from 'react';

export const useStyles = makeStyles((theme, _: PropsWithChildren) => {
  return {
    iconContainer: {
      width: theme.spacing.xl * 4,
      height: theme.spacing.xl * 4,
      borderRadius: theme.spacing.xl * 4,
      backgroundColor: theme.colors.layerGrayLighter,
      alignItems: 'center',
      justifyContent: 'center',
    },
    messageContainer: {
      gap: theme.spacing.lg,
    }
  };
});
