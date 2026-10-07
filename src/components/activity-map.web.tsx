// react-native-maps ใช้บนเว็บไม่ได้ จึงแสดงแผนที่ OpenStreetMap ผ่าน Leaflet ใน iframe (HTML อยู่ใน leaflet-html.ts)

import { StyleSheet, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

import type { ActivityMapProps } from './activity-map';
import { activityMapHtml } from './leaflet-html';

export function ActivityMap(props: ActivityMapProps) {
  const { venue, height = 220 } = props;
  return (
    <View style={[styles.wrap, { height }]} accessibilityLabel={`แผนที่ ${venue.name}`}>
      <iframe
        title={`แผนที่ ${venue.name}`}
        srcDoc={activityMapHtml(props)}
        style={{ border: 0, width: '100%', height: '100%' }}
        // allow-same-origin: ให้ request ของ tile มี Referer ตามนโยบาย OpenStreetMap
        // (sandbox เปล่าเป็น origin "null" → OSM ตอบ 403 "Access blocked") HTML ใน iframe สร้างจากโค้ดเราเองและ escape แล้ว
        sandbox="allow-scripts allow-same-origin"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Colors.border },
});
