import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiGet, apiPost } from '@/lib/api';
import { COLORS, FONTS, SPACING } from '@/lib/theme';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface TutorGetResponse {
  messages: Message[];
  configured: boolean;
  queriesRemaining: number | null;
}

export default function TutorScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [configured, setConfigured] = useState(true);
  const listRef = useRef<FlatList<Message>>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<TutorGetResponse>('/api/mobile/tutor');
      setMessages(data.messages);
      setConfigured(data.configured);
    } catch (err) {
      Alert.alert('Could not load the Tutor', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    const content = input.trim();
    if (!content || sending) return;

    setInput('');
    setSending(true);
    // Optimistic: show the student's message immediately rather than
    // waiting on the round trip, since the Tutor's reply can take a few
    // seconds.
    const optimisticId = `pending-${Date.now()}`;
    setMessages((prev) => [...prev, { id: optimisticId, role: 'user', content }]);

    try {
      const { reply } = await apiPost<{ reply: string }>('/api/mobile/tutor', { content });
      setMessages((prev) => [...prev, { id: `${optimisticId}-reply`, role: 'assistant', content: reply }]);
    } catch (err) {
      Alert.alert('Message failed', err instanceof Error ? err.message : 'Try again.');
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setInput(content);
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={COLORS.cyan} />
      </SafeAreaView>
    );
  }

  if (!configured) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <Text style={styles.muted}>The AI Tutor isn&apos;t configured on this deployment yet.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <Text style={styles.muted}>What are you studying today?</Text>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  item.role === 'user' && { color: COLORS.background },
                ]}
              >
                {item.content}
              </Text>
            </View>
          )}
        />

        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about something you're studying…"
            placeholderTextColor={COLORS.muted}
            style={styles.input}
            multiline
          />
          <Pressable
            onPress={send}
            disabled={sending || !input.trim()}
            style={[styles.sendButton, (sending || !input.trim()) && { opacity: 0.4 }]}
          >
            {sending ? (
              <ActivityIndicator size="small" color={COLORS.background} />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  muted: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.muted, padding: SPACING.lg },
  list: { padding: SPACING.md, gap: SPACING.sm },
  bubble: { borderRadius: 12, padding: SPACING.md, maxWidth: '85%' },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.cyan,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.surface,
  },
  bubbleText: { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.white },
  inputRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    backgroundColor: COLORS.surface,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.white,
    fontFamily: FONTS.sans,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.cyan,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
  },
  sendButtonText: { fontFamily: FONTS.display, fontSize: 13, color: COLORS.background },
});
