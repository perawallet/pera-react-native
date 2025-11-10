import { makeStyles } from '@rneui/themed';

export const useStyles = makeStyles(theme => {
  return {
    drawer: {
      width: '90%',
    },
    container: {
      paddingHorizontal: 0,
      flex: 1,
    },
    headerContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.xl,
    },
    titleContainer: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
      alignItems: 'center',
    },
    accountSelection: {},
    titleText: {},
    titleIcon: {
      color: theme.colors.textMain,
      width: 24,
      height: 24,
    },
  };
});
