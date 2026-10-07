// หน้า HTML ของแผนที่ Leaflet + OpenStreetMap ใช้ร่วมกันระหว่างเว็บ (iframe) และ Android (WebView)
// Android ใน Expo Go ใช้ Google Maps ของ react-native-maps แล้วพื้นแผนที่ดำ จึงใช้แผนที่ชุดเดียวกับเว็บแทน
// เหตุผลที่เลือก OpenStreetMap: ฟรี ไม่ต้องมี API key clone แล้วเปิดดูได้ทันที
//
// คุยกับแอปผ่านข้อความ:
// - หน้าแผนที่ → แอป: send(msg) (WebView ใช้ ReactNativeWebView.postMessage, iframe ใช้ parent.postMessage)
// - แอป → หน้าแผนที่: onHost(data) (เว็บส่ง postMessage เข้า iframe, Android ใช้ injectJavaScript)

import { Colors, DEFAULT_CENTER } from '@/constants/theme';
import type { Coordinates } from '@/lib/geo';
import type { Venue } from '@/types/models';

import { CAMPUS_LABEL_CSS, campusLabelsScript } from './leaflet-campus-labels';
import type { MapMarker } from './pick-map';

export const MSG_READY = 'map:ready';
export const MSG_SELECT = 'map:select';
export const MSG_PICK = 'map:pick';
export const HOST_SET_PICKED = 'map:set-picked';
export const HOST_ME = 'map:me';

/** JSON.stringify + แทน "<" กันข้อความ (ชื่อสถานที่ ฯลฯ) ปิดแท็ก <script> ก่อนเวลา */
const safe = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

function page(css: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>html,body,#map{height:100%;margin:0}${css}</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  function send(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    else parent.postMessage(msg, '*');
  }
  var onHost = function () {};
  if (!window.ReactNativeWebView) window.addEventListener('message', function (e) { if (e.data) onHost(e.data); });
  // นโยบายของ OpenStreetMap ต้องมี Referer บอกว่าแอปไหนขอ tile (ไม่มี → 403 "Access blocked")
  function addTiles(map) {
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, referrerPolicy: 'strict-origin-when-cross-origin',
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
  }
${body}
  send({ type: '${MSG_READY}' });
</script></body></html>`;
}

/** แผนที่หมุดหลายจุด + โหมดปักหมุด (แท็บแผนที่, ฟอร์มสร้างกิจกรรม) */
export function pickMapHtml(props: {
  markers: MapMarker[];
  pickable: boolean;
  initialPicked: Coordinates | null;
  user: Coordinates | null;
  campusLabels: boolean;
}): string {
  return page(
    CAMPUS_LABEL_CSS,
    `
  var markers = ${safe(props.markers)};
  var pickable = ${props.pickable};
  var picked = ${safe(props.initialPicked)};
  var user = ${safe(props.user)};
  var map = L.map('map', { zoomControl: false });
  // ปุ่มซูมอยู่ซ้ายล่าง: มุมบนเป็นที่ของป้าย/ปุ่มที่หน้าแอปวางทับ
  L.control.zoom({ position: 'bottomleft' }).addTo(map);
  addTiles(map);
  // หมุดกิจกรรมอยู่ชั้นบนสุด: ป้ายชื่ออาคารเป็น marker (ชั้น 600) จะทับจุดวงกลม (ชั้น 400) จนมองไม่เห็น
  map.createPane('dots').style.zIndex = 650;
  var bounds = [];
  markers.forEach(function (m) {
    var label = document.createElement('span');
    label.textContent = m.title + (m.subtitle ? ' · ' + m.subtitle : ''); // textContent ไม่ตีความเป็น HTML
    L.circleMarker([m.latitude, m.longitude], { pane: 'dots', radius: 11, color: '#fff', weight: 2, fillColor: m.color, fillOpacity: 1 })
      .addTo(map).bindTooltip(label)
      .on('click', function (e) {
        L.DomEvent.stopPropagation(e);
        // โหมดปักหมุด: แตะโดนหมุดเดิมก็ถือว่าเลือกจุดนั้น (ไม่งั้นผู้ใช้จะงงว่าทำไมแตะแล้วไม่ติด)
        if (pickable) {
          setPicked({ latitude: e.latlng.lat, longitude: e.latlng.lng }, false);
          send({ type: '${MSG_PICK}', latitude: e.latlng.lat, longitude: e.latlng.lng });
        } else {
          send({ type: '${MSG_SELECT}', id: m.id });
        }
      });
    bounds.push([m.latitude, m.longitude]);
  });
  if (user) {
    L.circleMarker([user.latitude, user.longitude], { pane: 'dots', radius: 8, color: '#fff', weight: 2, fillColor: '#2563EB', fillOpacity: 1 })
      .addTo(map).bindTooltip('ตำแหน่งของคุณ');
    bounds.push([user.latitude, user.longitude]);
  }
  var pickedMarker = null;
  function setPicked(p, pan) {
    if (!p) return;
    if (!pickedMarker) {
      pickedMarker = L.marker([p.latitude, p.longitude], { draggable: pickable }).addTo(map);
      pickedMarker.on('dragend', function () {
        var ll = pickedMarker.getLatLng();
        send({ type: '${MSG_PICK}', latitude: ll.lat, longitude: ll.lng });
      });
    } else {
      pickedMarker.setLatLng([p.latitude, p.longitude]);
    }
    if (pan) map.panTo([p.latitude, p.longitude]);
  }
  if (picked) { setPicked(picked, false); bounds.push([picked.latitude, picked.longitude]); }
  map.on('click', function (e) {
    if (pickable) {
      setPicked({ latitude: e.latlng.lat, longitude: e.latlng.lng }, false);
      send({ type: '${MSG_PICK}', latitude: e.latlng.lat, longitude: e.latlng.lng });
    } else {
      send({ type: '${MSG_SELECT}', id: null });
    }
  });
  onHost = function (data) {
    if (data.type === '${HOST_SET_PICKED}') setPicked(data, true);
  };
  // จัดมุมมองให้เห็นทุกหมุด ทำเฉพาะตอนแผนที่มีขนาดจริงแล้ว
  // (การ์ดแผนที่ตอนเปิดหน้ายังกว้าง/สูงเกือบ 0 ถ้าจัดตอนนั้น Leaflet จะซูมสุดจนไม่เห็นหมุด)
  var fitted = false, userMoved = false;
  map.on('dragstart', function () { userMoved = true; });
  map.getContainer().addEventListener('wheel', function () { userMoved = true; }, { passive: true });
  function fitAll() {
    if (fitted || userMoved) return;
    map.invalidateSize();
    var size = map.getSize();
    if (size.x < 50 || size.y < 50) return;
    // เผื่อขอบบน/ล่างมากกว่า: หน้าแอปวางป้ายชื่อไว้มุมบน และปุ่มไว้มุมล่าง
    if (bounds.length > 1) map.fitBounds(bounds, { paddingTopLeft: [40, 80], paddingBottomRight: [40, 70], maxZoom: 17 });
    else if (bounds.length === 1) map.setView(bounds[0], 16);
    else map.setView([${DEFAULT_CENTER.latitude}, ${DEFAULT_CENTER.longitude}], 16); // ซูม 16 = เห็นชื่ออาคาร
    fitted = true;
  }
  // Leaflet ต้องมีมุมมองเริ่มต้นก่อนวาด tile → ตั้งไว้ก่อน แล้วค่อยจัดให้พอดีเมื่อรู้ขนาด
  map.setView([${DEFAULT_CENTER.latitude}, ${DEFAULT_CENTER.longitude}], 15);
  fitAll();
  if (window.ResizeObserver) new ResizeObserver(function () { map.invalidateSize(); fitAll(); }).observe(map.getContainer());
  window.addEventListener('resize', fitAll);
  ${props.campusLabels ? campusLabelsScript(`if (pickable) { setPicked(p, false); send({ type: '${MSG_PICK}', latitude: p.latitude, longitude: p.longitude }); }`) : ''}`,
  );
}

/** แผนที่สถานที่จัดงาน: หมุด (+ ตำแหน่งผู้ใช้ถ้ามี) */
export function activityMapHtml({ venue, title, user }: { venue: Venue; title: string; user?: Coordinates | null }): string {
  const userJs = user
    ? `L.circleMarker([${user.latitude}, ${user.longitude}], { radius: 8, color: '#157F3D', fillOpacity: 0.9 })
         .addTo(map).bindTooltip('ตำแหน่งของคุณ');
       map.fitBounds(L.latLngBounds([[${venue.latitude}, ${venue.longitude}], [${user.latitude}, ${user.longitude}]]).pad(0.3));`
    : '';
  return page(
    '',
    `
  var map = L.map('map').setView([${venue.latitude}, ${venue.longitude}], 16);
  addTiles(map);
  // JSON.stringify ทำให้เป็น string ของ JavaScript ที่ถูกต้องเสมอ (ชื่อที่มี \\ หรือขึ้นบรรทัดใหม่ไม่ทำให้แผนที่พัง)
  // escapeHtml กันชื่อถูกตีความเป็น HTML ใน popup และแทน "<" กันปิดแท็ก <script> ก่อนเวลา
  L.marker([${venue.latitude}, ${venue.longitude}]).addTo(map).bindPopup(${safe(`${escapeHtml(title)}<br>${escapeHtml(venue.name)}`)});
  ${userJs}`,
  );
}

/** แผนที่เส้นทาง: จุดหมาย + ตำแหน่งฉัน (ส่งมาทีหลังผ่าน onHost) + เส้นประเชื่อมสองจุด */
export function routeMapHtml(destination: Coordinates, destinationName: string): string {
  return page(
    CAMPUS_LABEL_CSS,
    `
  var dest = ${safe({ latitude: destination.latitude, longitude: destination.longitude })};
  var name = ${safe(destinationName)};
  var map = L.map('map').setView([dest.latitude, dest.longitude], 16);
  addTiles(map);
  ${campusLabelsScript()}
  var label = document.createElement('span');
  label.textContent = name; // textContent ไม่ตีความเป็น HTML
  L.circleMarker([dest.latitude, dest.longitude], { radius: 12, color: '#fff', weight: 3, fillColor: '${Colors.danger}', fillOpacity: 1 })
    .addTo(map).bindTooltip(label, { permanent: true, direction: 'top', offset: [0, -10] });
  var meMarker = null, line = null, lastMe = null, userMoved = false;
  // ผู้ใช้ลาก/ซูมเอง → หยุดจัดมุมมองอัตโนมัติ ไม่แย่งมือผู้ใช้
  map.on('dragstart', function () { userMoved = true; });
  map.getContainer().addEventListener('wheel', function () { userMoved = true; }, { passive: true });
  map.getContainer().addEventListener('touchstart', function () { userMoved = true; }, { passive: true });
  // จัดให้เห็นทั้งสองจุด ทำเฉพาะตอนแผนที่มีขนาดจริงแล้ว
  // (ระหว่างแอนิเมชันเปิดหน้า แผนที่กว้าง 0 ถ้าซูมตอนนั้น Leaflet จะซูมสุดจนไม่เห็นจุดหมาย)
  function fitBoth() {
    if (!lastMe || userMoved) return;
    map.invalidateSize();
    var size = map.getSize();
    if (size.x < 50 || size.y < 50) return;
    map.fitBounds([lastMe, [dest.latitude, dest.longitude]], { padding: [60, 60], maxZoom: 18 });
  }
  // ขนาดเปลี่ยน (เปิดหน้าเสร็จ, หมุนจอ, ย่อหน้าต่าง) → จัดมุมมองใหม่
  if (window.ResizeObserver) new ResizeObserver(fitBoth).observe(map.getContainer());
  window.addEventListener('resize', fitBoth);
  onHost = function (data) {
    if (data.type !== '${HOST_ME}') return;
    var p = [data.latitude, data.longitude];
    if (!meMarker) {
      meMarker = L.circleMarker(p, { radius: 9, color: '#fff', weight: 3, fillColor: '#2563EB', fillOpacity: 1 })
        .addTo(map).bindTooltip('ตำแหน่งของคุณ');
      line = L.polyline([p, [dest.latitude, dest.longitude]], { color: '${Colors.primary}', weight: 4, dashArray: '8 6' }).addTo(map);
    } else {
      meMarker.setLatLng(p);
      line.setLatLngs([p, [dest.latitude, dest.longitude]]);
    }
    // ได้ตำแหน่งครั้งแรก → จัดให้เห็นทั้งสองจุด หลังจากนั้นไม่ขยับกล้องเองตามทุกก้าว
    var first = !lastMe;
    lastMe = p;
    if (first) fitBoth();
  };`,
  );
}
