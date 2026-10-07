import Markdown from 'react-native-markdown-display';

import { colors } from '@/constants/theme';

/** Render de Markdown simple (contratos). */
export function MarkdownView({ children }: { children: string }) {
  return <Markdown style={markdownStyles}>{children}</Markdown>;
}

const markdownStyles = {
  body: { color: colors.text, fontSize: 14, lineHeight: 21 },
  heading1: { fontSize: 20, fontWeight: '800' as const, color: colors.text, marginBottom: 8 },
  heading2: { fontSize: 16, fontWeight: '700' as const, color: colors.text, marginTop: 12, marginBottom: 4 },
  heading3: { fontSize: 15, fontWeight: '700' as const, color: colors.text, marginTop: 8 },
  strong: { fontWeight: '700' as const },
  bullet_list: { marginVertical: 4 },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginVertical: 8 },
  th: { padding: 6, fontWeight: '700' as const, backgroundColor: colors.background },
  td: { padding: 6 },
  tr: { borderBottomWidth: 1, borderColor: colors.border, flexDirection: 'row' as const },
  hr: { backgroundColor: colors.border, marginVertical: 12 },
  link: { color: colors.primary },
};
