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
    icon: {
      width: 24,
      height: 24,
      backgroundColor: theme.colors.background,
    },
    valueBar: {
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.xl * 1.5,
    },
    valueTitleBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingTop: theme.spacing.xl,
    },
    valueTitle: {
      color: theme.colors.textGray,
    },
  };
});
