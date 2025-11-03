import { makeStyles } from '@rneui/themed';
import { PropsWithChildren } from 'react';

export const useStyles = makeStyles((theme, _: PropsWithChildren) => {
  return {
    activeLabel: {
      color: theme.colors.secondary,
    },
    passiveLabel: {
      color: theme.colors.textMain,
    },
    activeItem: {
      backgroundColor: theme.colors.layerGrayLightest,
      borderRadius: theme.spacing.xs,
    },
    passiveItem: {
      backgroundColor: theme.colors.background,
    },
    drawer: {
      width: '90%',
    },
    drawerItem: {
      backgroundColor: theme.colors.background,
    },
    drawerContainer: {
      padding: 0,
      margin: 0,
    },
    titleBar: {
      gap: theme.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.sm,
    },
    titleBarButtonContainer: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      alignItems: 'center',
    },
    sortButton: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    sortButtonTitle: {
      color: theme.colors.helperPositive,
    },
    addButton: {
      color: theme.colors.buttonSquareText,
      backgroundColor: theme.colors.buttonSquareBg,
      borderRadius: theme.spacing.sm,
      width: 40,
      height: 40,
    },
  };
});
