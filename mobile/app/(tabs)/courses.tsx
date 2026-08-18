import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CourseRow } from '@priorbyte/shared/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { COLORS, FONTS, SPACING } from '@/lib/theme';

export default function CoursesScreen() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const [{ data: courseRows }, { data: enrollments }] = await Promise.all([
      supabase.from('courses').select('*').order('code').returns<CourseRow[]>(),
      supabase.from('course_enrollments').select('course_id').eq('user_id', profile.id),
    ]);
    setCourses(courseRows ?? []);
    setEnrolledIds(new Set((enrollments ?? []).map((e) => e.course_id)));
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function toggle(courseId: string, enrolled: boolean) {
    if (!profile) return;
    setPending(courseId);
    if (enrolled) {
      await supabase.from('course_enrollments').delete().eq('course_id', courseId).eq('user_id', profile.id);
      setEnrolledIds((prev) => {
        const next = new Set(prev);
        next.delete(courseId);
        return next;
      });
    } else {
      await supabase.from('course_enrollments').insert({ course_id: courseId, user_id: profile.id });
      setEnrolledIds((prev) => new Set(prev).add(courseId));
    }
    setPending(null);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={courses}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.cyan} />}
        ListHeaderComponent={
          <>
            <Text style={styles.label}>Courses</Text>
            <Text style={styles.title}>Browse & enroll.</Text>
          </>
        }
        ListEmptyComponent={<Text style={styles.muted}>No courses have been created yet.</Text>}
        renderItem={({ item }) => {
          const enrolled = enrolledIds.has(item.id);
          return (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{item.code}</Text>
                <Text style={styles.cardTitle}>{item.title}</Text>
                {item.institution && <Text style={styles.tinyLabel}>{item.institution}</Text>}
              </View>
              <Pressable
                onPress={() => void toggle(item.id, enrolled)}
                disabled={pending === item.id}
                style={[
                  styles.toggleButton,
                  { borderColor: enrolled ? COLORS.amber : COLORS.cyan },
                ]}
              >
                <Text style={[styles.toggleButtonText, { color: enrolled ? COLORS.amber : COLORS.cyan }]}>
                  {enrolled ? 'Leave' : 'Enroll'}
                </Text>
              </Pressable>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
  label: {
    fontFamily: FONTS.label,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: COLORS.muted,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 20,
    textTransform: 'uppercase',
    color: COLORS.white,
    marginTop: 4,
    marginBottom: SPACING.lg,
  },
  muted: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted },
  tinyLabel: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted, marginTop: 2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardTitle: { fontFamily: FONTS.sans, fontSize: 15, color: COLORS.white, marginTop: 2 },
  toggleButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs },
  toggleButtonText: { fontFamily: FONTS.label, fontSize: 11, textTransform: 'uppercase' },
});
