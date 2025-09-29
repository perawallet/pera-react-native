import { makeStyles } from '@rneui/themed';
import { PropsWithChildren } from 'react';

export const useStyles = makeStyles((theme, _: PropsWithChildren) => {
  return {
    iconBar: {
      padding: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: theme.spacing.lg,
    },
    iconBarColumn: {
      width: '33.3333%',
      flexDirection: 'row',
      justifyContent: 'center',
      textAlign: 'center',
      gap: theme.spacing.xl,
    },
    icon: {
      width: 24,
      height: 24,
      backgroundColor: 'transparent',
      color: theme.colors.textMain
    },
    menuContainer: {
      gap: theme.spacing.md,
      flex: 1,
      flexDirection: 'column',
      marginTop: theme.spacing.xl,
    },
  };
});
