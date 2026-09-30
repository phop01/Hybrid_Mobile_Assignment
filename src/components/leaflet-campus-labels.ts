// สคริปต์ป้ายชื่ออาคารสำหรับแผนที่ Leaflet บนเว็บ (ใช้ใน pick-map.web / route-map.web)
// ใส่ข้อความด้วย textContent ไม่ตีความเป็น HTML · ซ่อนเมื่อซูมออกไกลจนป้ายทับกัน

import { CAMPUS_PLACES } from '@/lib/campus';

/** CSS ของป้าย ใส่ใน <style> ของหน้า iframe */
export const CAMPUS_LABEL_CSS =
  '.campus-label span{display:inline-block;transform:translate(-50%,-50%);white-space:nowrap;' +
  'background:rgba(255,255,255,.92);border:1px solid #E1E3EC;border-radius:6px;padding:1px 5px;' +
  'font:600 11px system-ui,sans-serif;color:#16182B}' +
  '.hide-campus-labels .campus-label{display:none}' +
  '.hide-minor-labels .campus-label.minor{display:none}';

/**
 * โค้ด JavaScript ที่วางต่อจากการสร้าง `map` ใน iframe
 * onPickExpr: นิพจน์ JS ที่เรียกเมื่อแตะป้าย (รับตัวแปร p = {latitude, longitude}) ส่ง '' ถ้าไม่ต้องทำอะไร
 */
export function campusLabelsScript(onPickExpr = ''): string {
  const places = JSON.stringify(CAMPUS_PLACES.map((p) => ({ lat: p.latitude, lng: p.longitude, name: p.shortName, full: p.name, minor: !!p.minor }))).replace(
    /</g,
    '\\u003c',
  );
  return `
  (function () {
    var places = ${places};
    places.forEach(function (c) {
      var el = document.createElement('span');
      el.textContent = c.name;
      el.title = c.full;
      var m = L.marker([c.lat, c.lng], { icon: L.divIcon({ className: c.minor ? 'campus-label minor' : 'campus-label', html: el, iconSize: null }), zIndexOffset: -1000, keyboard: false }).addTo(map);
      m.on('click', function (e) { L.DomEvent.stopPropagation(e); var p = { latitude: c.lat, longitude: c.lng }; ${onPickExpr} });
    });
    var toggle = function () {
      var z = map.getZoom();
      map.getContainer().classList.toggle('hide-campus-labels', z < 16);
      map.getContainer().classList.toggle('hide-minor-labels', z < 17);
    };
    map.on('zoomend', toggle);
    toggle();
  })();`;
}
