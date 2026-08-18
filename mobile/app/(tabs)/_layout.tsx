import { Tabs } from 'expo-router';
import { COLORS, FONTS } from '@/lib/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.cyan,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarStyle: { backgroundColor: COLORS.surface, borderTopColor: COLORS.line },
        tabBarLabelStyle: { fontFamily: FONTS.label, fontSize: 10, textTransform: 'uppercase' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="tutor" options={{ title: 'Tutor' }} />
      <Tabs.Screen name="tools" options={{ title: 'Tools', headerShown: false }} />
      <Tabs.Screen name="timeline" options={{ title: 'Timeline' }} />
      <Tabs.Screen name="ghost-score" options={{ title: 'Score' }} />
      <Tabs.Screen name="memory" options={{ title: 'Memory' }} />
      <Tabs.Screen name="oracle" options={{ title: 'Oracle' }} />
      <Tabs.Screen name="courses" options={{ title: 'Courses' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
