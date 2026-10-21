// A szerver-tesztek rogzitett idovel futnak (2026-10-14 10:00 UTC = a tesztek MOST-ja): a Salonic-adapter es mas ido-erzekeny kod a valos orat olvassa, es a valos ora
// elorehaladasa (pl. a START = MOST + 6 nap mar a multban van) felborna a teszteket. Hasznalat: node --require ./tools/rogzitett-ora.cjs --test tools/test-gy-szerver.mjs
const T = Date.UTC(2026, 9, 14, 10, 0, 0);
const Eredeti = Date;
globalThis.Date = class extends Eredeti {
  constructor(...a) { if (a.length === 0) super(T); else super(...a); }
  static now() { return T; }
};
