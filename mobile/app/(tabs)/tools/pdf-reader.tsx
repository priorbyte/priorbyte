import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Stack } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { apiPost } from '@/lib/api';
import { COLORS, FONTS, SPACING } from '@/lib/theme';

const MAX_FILE_BYTES = 6 * 1024 * 1024;

export default function PdfReaderScreen() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileData, setFileData] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset) return;
    if ((asset.size ?? 0) > MAX_FILE_BYTES) {
      Alert.alert('Too large', 'That PDF is too large (max 6MB).');
      return;
    }

    const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
    setFileName(asset.name);
    setFileData(base64);
    setSummary(null);
  }

  async function generate() {
    if (!fileData || !fileName) return;
    setLoading(true);
    try {
      const data = await apiPost<{ summary: string }>('/api/mobile/tools/pdf-reader', {
        fileData,
        fileName,
        mimeType: 'application/pdf',
      });
      setSummary(data.summary);
    } catch (err) {
      Alert.alert('Could not read that PDF', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'PDF Reader' }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Pressable onPress={pickFile} style={styles.picker}>
          <Text style={styles.pickerText}>{fileName ?? 'Choose a PDF (max 6MB)'}</Text>
        </Pressable>

        <Pressable onPress={generate} disabled={loading || !fileData} style={styles.submitButton}>
          {loading ? (
            <ActivityIndicator color={COLORS.background} />
          ) : (
            <Text style={styles.submitButtonText}>Summarize PDF</Text>
          )}
        </Pressable>

        {summary && (
          <View style={styles.resultCard}>
            <Text style={styles.resultText}>{summary}</Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
  picker: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.line,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  pickerText: { fontFamily: FONTS.sans, fontSize: 13, color: COLORS.silver },
  submitButton: {
    alignItems: 'center',
    backgroundColor: COLORS.cyan,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.md,
  },
  submitButtonText: { fontFamily: FONTS.display, fontSize: 14, color: COLORS.background },
  resultCard: {
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
  },
  resultText: { fontFamily: FONTS.sans, fontSize: 14, color: COLORS.silver, lineHeight: 20 },
});
