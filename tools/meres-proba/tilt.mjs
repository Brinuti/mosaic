// A kimeno meresi kerelmek tiltasa (kozos a mero-szkriptekhez): ALAPBOL TILTO.
// A sajat es a Salonic-oldalakon, a reCAPTCHA-n es nehany statikus konyvtar-CDN-en kivul minden harmadik fel fele csak a (GET) szkript- /
// betutoltes engedett; minden mas (barmilyen POST, ismeretlen host, a stape vegpontjai) naplozva es tiltva. A csak meresre szolgalo hostok
// DNS-szinten sem feloldhatok (masodik vedvonal).
export const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
export const UA_MOBIL = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

export const SZABALYOK = [
  ['google-ads', /^https:\/\/(www\.googleadservices\.com\/(pagead|ccm)\/|googleads\.g\.doubleclick\.net\/pagead\/|www\.google\.(com|hu)\/(pagead\/|rmkt\/|ccm\/)|pagead2\.googlesyndication\.com\/|ad\.doubleclick\.net\/)/],
  ['ga4', /^https:\/\/(region\d\.analytics\.google\.com\/|www\.google-analytics\.com\/|analytics\.google\.com\/|stats\.g\.doubleclick\.net\/g\/|www\.google\.hu\/ads\/ga-audiences)/],
  ['stape', /^https:\/\/(stape\.mosaicheadspa\.hu\/(g\/collect|data|_\/)|capig\.stape\.[a-z]+\/)/],
  ['meta', /^https:\/\/www\.facebook\.com\/tr[/?]/],
  ['tiktok', /^https:\/\/(analytics\.tiktok\.com\/api\/|analytics-ipv6\.tiktokw\.us\/|mcs\.tiktok\.com\/)/],
  ['zapier', /^https:\/\/hooks\.zapier\.com\//],
];
export const platformOf = (url) => (SZABALYOK.find(([, re]) => re.test(url)) || [])[0] || null;

const ENGEDETT_GET = [
  /^https:\/\/(www\.)?mosaicheadspa\.hu\//,
  /^https:\/\/[a-z0-9.-]*salonic\.hu\//,
  /^https:\/\/www\.googletagmanager\.com\/(gtm\.js|gtag\/js|gtag\/destination)/,
  /^https:\/\/connect\.facebook\.net\/[^?]*(fbevents\.js|signals\/config\/)/,
  /^https:\/\/analytics\.tiktok\.com\/i18n\/pixel\/[^?]*\.js/,
  /^https:\/\/cdn\.trustindex\.io\//,
  /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//,
  /^https:\/\/stape\.mosaicheadspa\.hu\/[^?]*\.js(\?|$)/,
  /^https:\/\/www\.(facebook|youtube|youtube-nocookie)\.com\/(embed|plugins|v\d)/,
  /^https:\/\/(i\.ytimg\.com|img\.youtube\.com)\//,
  /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|code\.jquery\.com|ajax\.googleapis\.com|maxcdn\.bootstrapcdn\.com|stackpath\.bootstrapcdn\.com|use\.fontawesome\.com)\//,
];
// a Salonic maga barmilyen metodussal; a reCAPTCHA (a Salonic sajat vedelme, nem meres) barmilyen metodussal; a tobbi csak GET
// a sajat PR-elonezetek (Cloudflare Pages: <ag>.mosaic-d77.pages.dev) is a sajat oldalunk: barmilyen metodussal engedett (a meres ott ugyse fut: nem eles domain)
export const engedett = (url, method) => /^https:\/\/([a-z0-9-]+\.)?mosaic-d77\.pages\.dev\//.test(url) || /^https:\/\/[a-z0-9.-]*salonic\.hu\//.test(url)
  || /^https:\/\/(www\.google\.com\/recaptcha\/|www\.gstatic\.com\/recaptcha\/|www\.recaptcha\.net\/)/.test(url)
  || (method === 'GET' && ENGEDETT_GET.some((re) => re.test(url)));

export const DNS_TILTAS = ['capig.stape.do', 'capig.stape.de', 'capig.stape.io', 'analytics-ipv6.tiktokw.us', 'mcs.tiktok.com', 'hooks.zapier.com', 'region1.analytics.google.com',
  'www.googleadservices.com', 'googleads.g.doubleclick.net', 'ad.doubleclick.net', 'stats.g.doubleclick.net', 'pagead2.googlesyndication.com', 'www.google-analytics.com', 'analytics.google.com'];
export const dnsArg = () => '--host-resolver-rules=' + DNS_TILTAS.map((h) => `MAP ${h} ~NOTFOUND`).join(', ');

export const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

/** A tiltott keres "sikeres" valasza (CORS-fejlecekkel), hogy a cimkek ne probalkozzanak ujra. */
export function ures(req) {
  const cors = { 'access-control-allow-origin': req.headers().origin || '*', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
  if (req.method() === 'OPTIONS') return { status: 204, headers: cors };
  if (req.resourceType() === 'image') return { status: 200, headers: { 'content-type': 'image/gif', ...cors }, body: GIF };
  return { status: 200, headers: { 'content-type': 'application/json', ...cors }, body: '{}' };
}

/** A hozzajarulas elfogadasa (a tulajdonos jovahagyasaval): a sajat tarolonkba irva, mint a suti-sav gombja. */
export const hozzajarulasScript = () => {
  try { if (/(^|\.)mosaicheadspa\.hu$/.test(location.hostname) && !localStorage.getItem('mh_cc')) localStorage.setItem('mh_cc', JSON.stringify({ v: 1, t: Date.now(), fun: true, ana: true, adv: true })); } catch (e) { /* nem baj */ }
};
