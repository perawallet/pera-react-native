import { makeStyles } from '@rneui/themed';
import { PropsWithChildren } from 'react';

export const useStyles = makeStyles((theme, _: PropsWithChildren) => {
  return {
    drawer: {
      width: '90%',
    },
    iconBar: {
      paddingVertical: 0,
      paddingHorizontal: theme.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    iconBarSection: {
      flexDirection: 'row',
      gap: theme.spacing.lg,
    },
    accountSelection: {
      borderWidth: 1,
      borderColor: theme.colors.layerGrayLight,
      borderRadius: theme.spacing.xl,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    icon: {
      width: 24,
      height: 24,
      backgroundColor: theme.colors.background,
    },
    iconLight: {
      width: 24,
      height: 24,
      backgroundColor: theme.colors.layerGray,
    },
    valueBar: {
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.xl * 1.5,
    },
    secondaryValueBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
    dateDisplay: {
      color: theme.colors.textGray,
      textAlign: 'left',
    },
    primaryCurrency: {
      color: theme.colors.textMain,
    },
    webview: {
      flex: 1,
      paddingHorizontal: theme.spacing.xl,
    },
    webviewContent: {
      paddingBottom: theme.spacing.xl,
    },
    scannerClose: {
      marginTop: theme.spacing.xl,
      marginLeft: theme.spacing.lg,
      width: theme.spacing.xl * 2,
      height: theme.spacing.xl * 2,
      zIndex: 2,
    },
  };
});
