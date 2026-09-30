// ค่าเริ่มต้นของ Expo + ส่งต่อ /api/* ไปยัง API server (พอร์ต 3001) ในเครื่องเดียวกัน
// เหตุผล: ตอนนำเสนอใช้ `npm run present` (expo --tunnel) ซึ่งเปิดออกเน็ตแค่พอร์ต Metro
// แอปจึงเรียก API ผ่าน https://<tunnel>/api ได้ด้วย URL เดียว (ดู src/services/api-config.ts)
const http = require('node:http');
const { getDefaultConfig } = require('expo/metro-config');

const API_PORT = Number(process.env.API_PORT ?? 3001);

const config = getDefaultConfig(__dirname);

function proxyToApi(req, res) {
  const upstream = http.request(
    {
      host: '127.0.0.1',
      port: API_PORT,
      method: req.method,
      path: req.url.slice('/api'.length) || '/',
      headers: { ...req.headers, host: `127.0.0.1:${API_PORT}` },
    },
    (apiRes) => {
      res.writeHead(apiRes.statusCode ?? 502, apiRes.headers);
      apiRes.pipe(res);
    },
  );
  upstream.on('error', () => {
    if (res.headersSent) return res.end();
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 'api_offline', message: 'เชื่อมต่อ API ไม่ได้ (เปิด npm start หรือยัง)' }));
  });
  req.pipe(upstream);
}

const previous = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const next = previous ? previous(middleware, server) : middleware;
  return (req, res, nextFn) => {
    if (req.url === '/api' || req.url.startsWith('/api/')) return proxyToApi(req, res);
    return next(req, res, nextFn);
  };
};

module.exports = config;
