import { makeStyles } from '@rneui/themed';
import { EdgeInsets } from 'react-native-safe-area-context';

export const useStyles = makeStyles((theme, insets: EdgeInsets) => {
  return {
    container: {
      flex: 1,
      minHeight: 500
    },
    title: {
      padding: theme.spacing.lg,
      fontWeight: 600,
      textAlign: 'center',
      marginBottom: theme.spacing.lg
    },
    body: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.lg,
    },
    footer: {
      padding: theme.spacing.lg,
      borderTopWidth: 1,
      borderTopColor: theme.colors.layerGrayLighter,
      gap: theme.spacing.sm,
      boxShadow: '0px 14px 60px 0px #00000029'
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: theme.spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderTopWidth: 1,
      borderTopColor: theme.colors.layerGrayLightest,
      paddingVertical: theme.spacing.sm,
    },
    button: {
      flexGrow: 1,
    },
    feeContainer: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    detailsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    feeLabel: {
      color: theme.colors.textGray
    },
    feeAmount: {
      color: theme.colors.helperNegative
    },
    detailsLabel: {
      color: theme.colors.linkPrimary
    },
    mainAmount: {
    },
    secondaryAmount: {
    }
  };
});
