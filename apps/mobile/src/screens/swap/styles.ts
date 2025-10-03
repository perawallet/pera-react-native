import { makeStyles } from '@rneui/themed';

export const useStyles = makeStyles((theme) => {
  return {
    container: {
      paddingHorizontal: 0,
      flex: 1,
    },
    headerContainer: {
      marginTop: theme.spacing.xl,
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
