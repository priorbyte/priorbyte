import { Stack } from 'expo-router';
import { COLORS, FONTS } from '@/lib/theme';

export default function MoreLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.cyan,
        headerTitleStyle: { fontFamily: FONTS.label, fontSize: 14 },
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'More' }} />
      <Stack.Screen name="memory" options={{ title: 'Memory' }} />
      <Stack.Screen name="courses" options={{ title: 'Courses' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="marketplace" options={{ title: 'Campus Opportunities' }} />
    </Stack>
  );
}
