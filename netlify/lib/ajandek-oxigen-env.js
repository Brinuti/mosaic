// Az OXIGENTERAPIA ajandekkartya kereskedo kornyezete: az OXIGEN_* beallitasok a motor altalanos neveire (STRIPE_*, SZAMLAZZ_AGENT_KULCS) kepezve.
// A HeadSpa (es a lezeres) kulcsai SOHA nem kerulnek at: ha az oxigenes kulcs hianyzik, ures marad (a motor ilyenkor 503-at ad, nem a HeadSpa fiokjaval dolgozik).
// Kulon modulban van, hogy tesztelheto legyen (a Pages-fuggveny fajlja csak a kereskedo-kotest es a levelkuldest tartalmazza).
export function oxigenKornyezet(env) {
  env = env || {};
  return {
    ...env,
    STRIPE_SECRET_KEY: env.OXIGEN_STRIPE_SECRET_KEY || '',
    STRIPE_PUBLISHABLE_KEY: env.OXIGEN_STRIPE_PUBLISHABLE_KEY || '',
    STRIPE_WEBHOOK_SECRET: env.OXIGEN_STRIPE_WEBHOOK_SECRET || '',
    SZAMLAZZ_AGENT_KULCS: env.OXIGEN_SZAMLAZZ_AGENT_KULCS || '',
    AJANDEK_TITOK: env.OXIGEN_AJANDEK_TITOK || env.AJANDEK_TITOK,
    // nincs Stripe-szamla (a szamlat a Szamlazz.hu Agent allitja ki) es egyelore nincs szerveroldali Zapier-meres
    AJANDEK_STRIPE_SZAMLA: '0',
    MERES_HOOK_URL: '',
  };
}
