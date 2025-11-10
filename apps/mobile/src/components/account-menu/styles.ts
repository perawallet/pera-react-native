import { makeStyles } from '@rneui/themed';
import { PropsWithChildren } from 'react';

export const useStyles = makeStyles((theme, _: PropsWithChildren) => {
  return {
    portfolioContainer: {
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.md,
    },
    activeLabel: {
      color: theme.colors.secondary,
    },
    passiveLabel: {
      color: theme.colors.textMain,
    },
    accountContainer: {
      paddingHorizontal: theme.spacing.xl,
      gap: theme.spacing.md,
    },
    activeItem: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      backgroundColor: theme.colors.layerGrayLightest,
      borderRadius: theme.spacing.xs,
      paddingVertical: theme.spacing.md,
    },
    passiveItem: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      backgroundColor: theme.colors.background,
      borderRadius: theme.spacing.xs,
      paddingVertical: theme.spacing.md,
    },
    container: {
      padding: 0,
      margin: 0,
      flex: 1,
      overflow: 'hidden',
    },
    titleBar: {
      gap: theme.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xl,
    },
    titleBarButtonContainer: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
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
    addButtonContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingEnd: theme.spacing.md,
      borderRadius: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    addButtonTitle: {
      color: theme.colors.buttonSquareText,
    },
    addButton: {
      color: theme.colors.buttonSquareText,
      width: 40,
      height: 40,
    },
    fullWidth: {
      width: '100%',
    },
    tabs: {
      paddingHorizontal: 0,
      paddingBottom: theme.spacing.sm,
      margin: 0,
      borderWidth: 1,
      borderColor: theme.colors.background,
    },
    activeTab: {
      padding: 0,
      margin: 0,
    },
    inactiveTab: {
      padding: 0,
      margin: 0,
    },
    activeTitle: {
      color: theme.colors.textMain,
      fontSize: 22,
    },
    inactiveTitle: {
      color: theme.colors.textGrayLighter,
      fontSize: 22,
    },
  };
});
