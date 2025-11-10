import { makeStyles } from '@rneui/themed';

export const useStyles = makeStyles(theme => {
  return {
    container: {
      backgroundColor: theme.colors.background,
    },
    flex: {
      flex: 1,
    },
    sectionHeader: {
      color: theme.colors.textGray,
      borderBottomColor: theme.colors.layerGrayLighter,
      borderBottomWidth: 1,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
    },
    contactContainer: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      alignItems: 'center',
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.sm,
    },
    contactName: {},
    search: {
      borderRadius: theme.spacing.lg,
      paddingHorizontal: theme.spacing.xs,
    },
    empty: {
      marginTop: theme.spacing.xl,
      flex: 1,
      backgroundColor: 'red',
      alignItems: 'center',
      justifyContent: 'center',
    },
  };
});
