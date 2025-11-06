import { makeStyles } from '@rneui/themed';
import { PropsWithChildren } from 'react';

export const useStyles = makeStyles((theme, _: PropsWithChildren) => {
  return {
    iconBar: {
      paddingVertical: 0,
      paddingHorizontal: theme.spacing.xl,
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
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.md,
    },
    valueBarCurrencies: {
      flexShrink: 1,
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
    chartButton: {
      verticalAlign: 'middle',
      justifyContent: 'center',
      alignItems: 'center',
    },
    chartButtonText: {
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.layerGrayLight,
    },
  };
});
