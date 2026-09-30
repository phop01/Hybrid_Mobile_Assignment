// WebView ที่แสดงหน้าแผนที่ Leaflet (leaflet-html.ts) ใช้ใน *.android.tsx
// Android ใน Expo Go: Google Maps ของ react-native-maps พื้นแผนที่ดำ จึงใช้แผนที่ชุดเดียวกับเว็บแทน

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

import { MSG_READY } from './leaflet-html';
import { MapLoading } from './map-loading';

// baseUrl ทำให้ request ของ tile มี Referer ตามนโยบาย OpenStreetMap (ไม่มี → 403 "Access blocked")
const BASE_URL = 'https://nktoday.app/';

export type LeafletWebViewHandle = {
  /** ส่งข้อมูลเข้า onHost() ในหน้าแผนที่ */
  send: (data: Record<string, unknown>) => void;
};

type Props = {
  html: string;
  /** ข้อความจากหน้าแผนที่ (parse JSON แล้ว ผู้รับต้องตรวจรูปแบบเอง) */
  onMessage?: (data: Record<string, unknown>) => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  onInteractingChange?: (interacting: boolean) => void;
};

export const LeafletWebView = forwardRef<LeafletWebViewHandle, Props>(function LeafletWebView(
  { html, onMessage, style, accessibilityLabel, onInteractingChange },
  ref,
) {
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  useImperativeHandle(ref, () => ({
    send: (data) => {
      // JSON.stringify ทำให้เป็นนิพจน์ JavaScript ที่ปลอดภัยเสมอ
      webRef.current?.injectJavaScript(`onHost(${JSON.stringify(data)});true;`);
    },
  }));

  return (
    <View
      style={style}
      accessibilityLabel={accessibilityLabel}
      onTouchStart={() => onInteractingChange?.(true)}
      onTouchEnd={() => onInteractingChange?.(false)}
      onTouchCancel={() => onInteractingChange?.(false)}>
      <WebView
        ref={webRef}
        style={StyleSheet.absoluteFill}
        source={{ html, baseUrl: BASE_URL }}
        originWhitelist={['*']}
        nestedScrollEnabled
        setSupportMultipleWindows={false}
        // ไม่ให้แตะลิงก์ (เช่น เครดิต OpenStreetMap) แล้วหน้าแผนที่เปลี่ยนไปเป็นเว็บอื่น
        onShouldStartLoadWithRequest={(req) => req.url.startsWith(BASE_URL) || req.url === 'about:blank'}
        onLoadStart={() => setReady(false)}
        onMessage={(e) => {
          let data: unknown;
          try {
            data = JSON.parse(e.nativeEvent.data);
          } catch {
            return;
          }
          if (typeof data !== 'object' || data === null) return;
          const msg = data as Record<string, unknown>;
          if (msg.type === MSG_READY) setReady(true);
          onMessage?.(msg);
        }}
      />
      {ready ? null : <MapLoading />}
    </View>
  );
});
