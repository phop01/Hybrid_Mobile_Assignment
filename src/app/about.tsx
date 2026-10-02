import { StyleSheet, View } from 'react-native';

import { Card, Screen } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { WEEKS } from '@/lib/weeks';
import { Text } from '@/components/app-text';

/** สรุปว่าเนื้อหาสัปดาห์ 1–14 ถูกใช้ตรงไหนในแอป (ใช้ประกอบการนำเสนอ) */
export default function AboutScreen() {
  return (
    <Screen>
      <Text style={styles.intro}>
        KKUNK Today รวมกิจกรรม จิตอาสา และประกาศของ มข. วิทยาเขตหนองคาย ไว้ในแอปเดียว
        ด้านล่างคือเนื้อหาแต่ละสัปดาห์ที่นำมาใช้
      </Text>
      {WEEKS.map((w) => (
        <Card key={w.week} style={styles.card}>
          <View style={styles.row}>
            <View style={styles.badge}>
              <Text style={styles.badgeText} maxFontSizeMultiplier={1.4}>
                W{w.week}
              </Text>
            </View>
            <Text style={styles.topic} accessibilityRole="header">
              {w.topic}
            </Text>
          </View>
          <Text style={styles.where}>{w.where}</Text>
          <Text style={styles.files}>{w.files}</Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 15, color: Colors.text, lineHeight: 22 },
  card: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  badge: { backgroundColor: Colors.primary, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 4, minWidth: 44, alignItems: 'center' },
  badgeText: { color: Colors.onPrimary, fontWeight: '800' },
  topic: { flex: 1, fontSize: 16, fontWeight: '700', color: Colors.text },
  where: { fontSize: 14, color: Colors.text, lineHeight: 21 },
  files: { fontSize: 12, color: Colors.textMuted, fontFamily: 'monospace' },
});
