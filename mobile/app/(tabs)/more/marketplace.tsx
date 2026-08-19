import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CampusListingRow } from '@priorbyte/shared/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { COLORS, FONTS, SPACING } from '@/lib/theme';

const CATEGORIES = ['Assignment Help', 'Tutoring', 'Design', 'Writing', 'Other'];

export default function MarketplaceScreen() {
  const { profile } = useAuth();
  const [listings, setListings] = useState<CampusListingRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('campus_listings')
      .select('*')
      .in('status', ['open', 'claimed'])
      .order('created_at', { ascending: false })
      .returns<CampusListingRow[]>();
    setListings(data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function post() {
    if (!profile || !title.trim() || !description.trim()) return;
    setPosting(true);
    const { error } = await supabase.from('campus_listings').insert({
      posted_by: profile.id,
      title: title.trim(),
      description: description.trim(),
      category,
    });
    setPosting(false);
    if (error) {
      Alert.alert('Could not post', error.message);
      return;
    }
    setTitle('');
    setDescription('');
    await load();
  }

  async function claim(listingId: string) {
    if (!profile) return;
    setPending(listingId);
    const { error } = await supabase
      .from('campus_listings')
      .update({ status: 'claimed', claimed_by: profile.id, claimed_at: new Date().toISOString() })
      .eq('id', listingId)
      .eq('status', 'open');
    setPending(null);
    if (error) {
      Alert.alert('Could not claim', error.message);
      return;
    }
    await load();
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={listings}
        keyExtractor={(l) => l.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.cyan} />}
        ListHeaderComponent={
          <>
            <Text style={styles.label}>Campus Opportunities</Text>
            <Text style={styles.title}>Trade time & skills.</Text>

            <View style={styles.postCard}>
              <Text style={styles.postLabel}>Post a listing</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Title"
                placeholderTextColor={COLORS.muted}
                maxLength={120}
                style={styles.input}
              />
              <View style={styles.categoryRow}>
                {CATEGORIES.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setCategory(c)}
                    style={[styles.categoryChip, category === c && styles.categoryChipActive]}
                  >
                    <Text style={[styles.categoryChipText, category === c && styles.categoryChipTextActive]}>
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="What do you need, and what's the deal?"
                placeholderTextColor={COLORS.muted}
                multiline
                maxLength={2000}
                style={[styles.input, styles.textArea]}
              />
              <Pressable
                onPress={post}
                disabled={posting || !title.trim() || !description.trim()}
                style={styles.postButton}
              >
                <Text style={styles.postButtonText}>{posting ? 'Posting…' : 'Post listing'}</Text>
              </Pressable>
            </View>
          </>
        }
        ListEmptyComponent={<Text style={styles.muted}>No open listings yet — be the first to post one.</Text>}
        renderItem={({ item }) => {
          const isOwner = item.posted_by === profile?.id;
          return (
            <View style={styles.card}>
              <Text style={styles.tinyLabel}>{item.category}</Text>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDescription}>{item.description}</Text>
              <View style={styles.cardFooter}>
                <Text style={[styles.statusBadge, item.status === 'claimed' && styles.statusBadgeClaimed]}>
                  {item.status === 'open' ? 'Open' : 'Claimed'}
                </Text>
                {item.status === 'open' && !isOwner && (
                  <Pressable onPress={() => void claim(item.id)} disabled={pending === item.id} style={styles.claimButton}>
                    <Text style={styles.claimButtonText}>Claim</Text>
                  </Pressable>
                )}
              </View>
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
  postCard: {
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  postLabel: { fontFamily: FONTS.label, fontSize: 11, textTransform: 'uppercase', color: COLORS.muted },
  input: {
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: SPACING.sm,
    color: COLORS.white,
    fontFamily: FONTS.sans,
    fontSize: 13,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  categoryChip: {
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 16,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  categoryChipActive: { borderColor: COLORS.cyan, backgroundColor: `${COLORS.cyan}22` },
  categoryChipText: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted },
  categoryChipTextActive: { color: COLORS.cyan },
  postButton: {
    alignItems: 'center',
    backgroundColor: COLORS.cyan,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.xs,
  },
  postButtonText: { fontFamily: FONTS.display, fontSize: 13, color: COLORS.background },
  card: {
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  tinyLabel: { fontFamily: FONTS.sans, fontSize: 11, color: COLORS.muted },
  cardTitle: { fontFamily: FONTS.sans, fontSize: 15, color: COLORS.white, marginTop: 2 },
  cardDescription: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.silver, marginTop: 4 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
  },
  statusBadge: {
    fontFamily: FONTS.label,
    fontSize: 10,
    textTransform: 'uppercase',
    color: COLORS.cyan,
    borderWidth: 1,
    borderColor: COLORS.cyan,
    borderRadius: 12,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  statusBadgeClaimed: { color: COLORS.amber, borderColor: COLORS.amber },
  claimButton: { borderWidth: 1, borderColor: COLORS.cyan, borderRadius: 8, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs },
  claimButtonText: { fontFamily: FONTS.label, fontSize: 11, textTransform: 'uppercase', color: COLORS.cyan },
});
