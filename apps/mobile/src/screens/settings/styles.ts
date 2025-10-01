import { makeStyles } from '@rneui/themed';
import { PropsWithChildren } from 'react';
import { EdgeInsets } from 'react-native-safe-area-context';

export const useStyles = makeStyles((theme, insets: EdgeInsets) => {
  return {
    sectionContainer: {
      gap: theme.spacing.xl * 1.5,
      marginBottom: theme.spacing.xl,
    },
    section: {
      flexDirection: 'column',
    },
    sectionTitle: {
      color: theme.colors.textGray,
      paddingBottom: theme.spacing.lg,
    },
    sectionRow: {
      flexDirection: 'row',
      gap: theme.spacing.lg,
      paddingVertical: theme.spacing.lg,
      alignItems: 'center'
    },
    sectionRowTitle: {
      flexGrow: 1
    },
    scrollView: {
      flex: 1,
      marginHorizontal: theme.spacing.xl,
      marginBottom: insets.bottom,
    },
    scrollViewContainer: {

    },
    versionText: {
      color: theme.colors.textGrayLighter,
      paddingVertical: theme.spacing.sm,
      textAlign: 'center',
      width: '100%',
      fontSize: 11,
    }
  };
});
