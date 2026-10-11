/*
 * Kepcimkezo (Mosaic + Medical Piercing) - nem titkos beallitasok.
 * A titkos OpenAI-kulcs NEM itt van: a Script Properties-ben (OPENAI_API_KEY).
 * A futas kozben allithato dolgok (elesites, idokeret, kill switch) a tablazat "beállítások" lapjan vannak.
 */
var KC = KC || {};

KC.CFG = {
  // A kimeneti Google Sheet (Drive: "Képtár-címkéző (Mosaic + Medical Piercing)" mappa)
  SHEET_ID: '1nCAutdyyrmR1ITCsIwVgeGZDawHHauO9wjTXhSnM6_I',
  SHEET_NAME: 'képek',
  LOG_NAME: 'napló',
  SETTINGS_NAME: 'beállítások',

  // Forrasmappak (rekurzivan). label = az utvonal eleje (az elemzo leltaraval egyezo: A / B / C).
  // only = a gyokerben csak ezek az almappak (normalizalt nev -> fiok); a tobbi (pl. Gyogytornaszom) kimarad.
  ROOTS: [
    { id: '1D4RsZ23n3TVjY1WUnCb1OljNDFkI2ASs', label: 'A', fiok: null,
      only: { 'mosaic head spa': 'Mosaic', 'medical piercing': 'MP' } },
    { id: '1QfY-MhoPp8qZMe2gQGlcVVz5S_q7FVpm', label: 'B', fiok: 'MP' },
    { id: '1-peL4-yYrxWagip5Jv8FAfWpfAO919wX', label: 'C', fiok: 'MP' }
  ],
  // Barmelyik szinten kihagyott mappak: a normalizalt (kisbetus, ekezet nelkuli) nev tartalmazza valamelyiket.
  // FIGYELEM: csak "influencer szerzodes" (NEM "influencer"): a "2025.02.13 Influencer videók" mappa tartalom, nem szerzodes.
  EXCLUDE_FOLDER_PARTS: ['jelszav', 'influencer szerzod'],

  // OpenAI
  MODEL: 'gpt-5.4-mini',
  DETAIL: 'low',
  BATCH: 8,                 // kep / hivas
  PARALLEL: 4,              // egyszerre futo OpenAI-hivas (es egyszerre kert Drive-lista)
  REASONING: '',            // ures = nem kuldjuk (az elemzo probaja is igy futott: 0 reasoning token)
  MAX_OUT_TOKENS_PER_IMAGE: 250,
  THUMB_PX: 384,

  // Ar (USD / 1M token, gpt-5.4-mini, standard). A kolteseket a valasz "usage" mezojebol szamoljuk.
  PRICE_IN_PER_M: 0.75,
  PRICE_OUT_PER_M: 4.5,
  MONTHLY_BUDGET_USD: 30,   // a tablazat "HAVI_KERET_USD" erteke felulirja
  STOP_AT_FRACTION: 0.9,    // a havi keret 90%-anal megall

  // Futas
  LIST_PARALLEL: 20,        // egyszerre ennyi mappa-lista (ha a Drive REST elerheto; kulonben sorban, egyesevel)
  SCAN_MAX_FRACTION: 0.7,   // a mappa-bejaras legfeljebb az idokeret ennyi reszet viheti el
  TIME_BUDGET_MIN: 20,      // Google Workspace: 30 perc/futas, privat gmail: 6 perc (a tablazat "IDOKERET_PERC" felulirja)
  GROUP_SAFETY_SEC: 90,     // ennyi masodperccel a hatarido elott mar nem kezd uj csoportot
  MAX_ATTEMPTS: 3,          // hibas / elonezet nelkuli fajl ennyiszer probalkozunk
  RETRY_AFTER_HOURS: 20,    // ...es legfeljebb ennyi oraval az elozo probalkozas utan
  PROBA_DB: 16,             // proba(): ennyi fajl (egyenletesen szorva a mappakban)
  DAILY_HOUR: 3,            // napi inditas (Europe/Budapest)
  CONTINUE_AFTER_MIN: 1     // ha maradt munka, ennyi perc mulva folytatja
};
