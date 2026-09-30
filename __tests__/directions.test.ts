// หน้าเส้นทางในแอป: ระยะ/เวลาเดิน และการตรวจพิกัดที่มาจากลิงก์
import { ARRIVED_RADIUS_M, distanceMeters, parseCoordinates, walkingMinutes } from '@/lib/geo';
import { directionsHref, mapsUrl } from '@/lib/platform-actions';

describe('walkingMinutes', () => {
  it('rounds up and never shows 0 minutes', () => {
    expect(walkingMinutes(0)).toBe(1);
    expect(walkingMinutes(80)).toBe(1);
    expect(walkingMinutes(81)).toBe(2);
    expect(walkingMinutes(350)).toBe(5);
  });
});

describe('arrival', () => {
  it('counts as arrived within 30 m of the destination', () => {
    const destination = { latitude: 17.8066, longitude: 102.7463 };
    const near = { latitude: 17.8068, longitude: 102.7463 }; // ~22 ม.
    const far = { latitude: 17.8076, longitude: 102.7463 }; // ~111 ม.
    expect(distanceMeters(near, destination)).toBeLessThanOrEqual(ARRIVED_RADIUS_M);
    expect(distanceMeters(far, destination)).toBeGreaterThan(ARRIVED_RADIUS_M);
  });
});

describe('parseCoordinates (route params มาจากภายนอก)', () => {
  it('accepts real coordinates', () => {
    expect(parseCoordinates('17.8066', '102.7463')).toEqual({ latitude: 17.8066, longitude: 102.7463 });
  });

  it('rejects missing, non-numeric and out-of-range values', () => {
    expect(parseCoordinates(undefined, '102')).toBeNull();
    expect(parseCoordinates('', '')).toBeNull();
    expect(parseCoordinates('abc', '102')).toBeNull();
    expect(parseCoordinates('200', '102')).toBeNull();
    expect(parseCoordinates('17', '-181')).toBeNull();
  });
});

describe('directionsHref', () => {
  it('builds params that parseCoordinates can read back and trims long names', () => {
    const href = directionsHref({ name: 'x'.repeat(120), latitude: 17.8066, longitude: 102.7463 });
    expect(href.pathname).toBe('/directions');
    expect(href.params.name).toHaveLength(80);
    expect(parseCoordinates(href.params.lat, href.params.lng)).toEqual({ latitude: 17.8066, longitude: 102.7463 });
  });
});

describe('mapsUrl (ปุ่มนำทางด้วยแผนที่)', () => {
  const place = { name: 'อาคารเรียนรวม 1', latitude: 17.803351, longitude: 102.74787 };

  it('opens the native maps app with walking directions to the exact spot', () => {
    expect(mapsUrl(place, 'ios')).toBe(`maps://?daddr=17.803351,102.74787&dirflg=w&q=${encodeURIComponent(place.name)}`);
    expect(mapsUrl(place, 'android')).toBe('google.navigation:q=17.803351,102.74787&mode=w');
  });

  it('uses Google Maps on the web', () => {
    expect(mapsUrl(place, 'web')).toBe('https://www.google.com/maps/dir/?api=1&destination=17.803351,102.74787&travelmode=walking');
  });
});
