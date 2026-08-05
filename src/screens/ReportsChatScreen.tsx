import React, { useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInventory } from '../data/store';
import {
  answerLocalChat,
  type ChatMessage,
} from '../lib/localChat';
import { colors, radius, spacing } from '../theme/colors';

const SUGGESTIONS = [
  'My inventory value right now',
  'Low stock',
  'How many falafel bowls can I make?',
  'Value by category',
  'Help',
];

export function ReportsChatScreen() {
  const insets = useSafeAreaInsets();
  const {
    products,
    session,
    recipes,
    defaultPortionErrorPercent,
    setDefaultPortionErrorPercent,
  } = useInventory();
  const listRef = useRef<FlatList>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'bot',
      text: [
        'Ask about your inventory — stock value, low stock, recipes, and more.',
        '',
        'Try stock value, low stock, or “how many falafel bowls”.',
      ].join('\n'),
    },
  ]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };
    const reply: ChatMessage = {
      id: `b-${Date.now()}`,
      role: 'bot',
      text: answerLocalChat(trimmed, {
        products,
        session,
        recipes,
        defaultPortionErrorPercent,
      }),
    };
    setMessages((prev) => [...prev, userMsg, reply]);
    setInput('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }

  const marginPct = Math.round(defaultPortionErrorPercent * 100);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={8}
    >
      <View style={{ paddingTop: spacing.sm, flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Reports</Text>
          <Text style={styles.title}>Reports chat</Text>
          <Text style={styles.sub}>
            Default portioning margin: {marginPct}%
          </Text>
          <View style={styles.marginRow}>
            {[10, 12, 15].map((p) => (
              <Pressable
                key={p}
                onPress={() => setDefaultPortionErrorPercent(p / 100)}
                style={[
                  styles.chip,
                  marginPct === p && styles.chipOn,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    marginPct === p && styles.chipTextOn,
                  ]}
                >
                  {p}%
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.md,
          }}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === 'user' ? styles.userBubble : styles.botBubble,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  item.role === 'user' && styles.userText,
                ]}
              >
                {item.text}
              </Text>
            </View>
          )}
        />

        <View style={styles.suggestRow}>
          {SUGGESTIONS.map((s) => (
            <Pressable key={s} onPress={() => send(s)} style={styles.suggest}>
              <Text style={styles.suggestText}>{s}</Text>
            </Pressable>
          ))}
        </View>

        <View
          style={[
            styles.composer,
            { paddingBottom: Math.max(insets.bottom, spacing.sm) },
          ]}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about stock or recipes…"
            placeholderTextColor={colors.inkFaint}
            style={styles.input}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
          />
          <Pressable style={styles.send} onPress={() => send(input)}>
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  kicker: {
    color: colors.success,
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink, marginTop: 2 },
  sub: { color: colors.inkMuted, marginTop: 4, fontSize: 13, lineHeight: 18 },
  marginRow: { flexDirection: 'row', gap: 8, marginTop: spacing.sm },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.inkMuted },
  chipTextOn: { color: '#fff' },
  bubble: {
    maxWidth: '92%',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
  },
  bubbleText: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  userText: { color: '#fff' },
  suggestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  suggest: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  suggestText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  composer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bgElevated,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.ink,
  },
  send: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  sendText: { color: '#fff', fontWeight: '700' },
});
