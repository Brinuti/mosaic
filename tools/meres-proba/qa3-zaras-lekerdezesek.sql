-- QA-3 zaras utani szamlalo: DECISION #110 szerinti sorok (a #128 D1-en, CSAK OLVASAS, vendegadat nincs).
-- Az ablak hatarai (epoch, UTC): :A = 1791404400 (2026-10-07 20:20:00), :B = 1791490800 (2026-10-08 20:20:00).
-- Minden lekerdezes egyetlen sort ad; a kimenet a Cloudflare MCP d1_database_query-vel kerul a naplobe.

-- 1) Lejart "fuggoben" sorok. A lusta lezaras (kulcsos GET) ELOTT es UTAN is lefuttatando.
--    fuggoben_nem_lejart = meg futo ujraprobalas (kovetkezo a jovoben): kulon sor, nem a "lejart" resze.
SELECT
  (SELECT count(*) FROM foglalas_egyeztetes WHERE letrehozva >= :A AND letrehozva < :B) AS sorok_osszes,
  (SELECT count(*) FROM foglalas_egyeztetes WHERE letrehozva >= :A AND letrehozva < :B AND allapot = 'fuggoben') AS fuggoben_osszes,
  (SELECT count(*) FROM foglalas_egyeztetes WHERE letrehozva >= :A AND letrehozva < :B AND allapot = 'fuggoben'
     AND (kovetkezo IS NULL OR kovetkezo <= CAST(strftime('%s','now') AS INTEGER))) AS fuggoben_lejart,
  (SELECT count(*) FROM foglalas_egyeztetes WHERE letrehozva >= :A AND letrehozva < :B AND allapot = 'fuggoben'
     AND kovetkezo > CAST(strftime('%s','now') AS INTEGER)) AS fuggoben_nem_lejart;

-- 1b) Allapot-eloszlas az ablakban.
SELECT allapot, count(*) AS db, sum(riasztas) AS riasztas, sum(booking_id IS NOT NULL) AS parositott
FROM foglalas_egyeztetes WHERE letrehozva >= :A AND letrehozva < :B GROUP BY allapot ORDER BY allapot;

-- 2) Teves elo kuldes: elkuldott sor, amelynek celpontja NEM az ARNYEK-celpont, vagy tiltott elo azonositot tartalmaz
--    (tiltolista: netlify/lib/meres/platformok.js ELO_CELOK, ca2ff64). Csak a #128 szerver-naplojat latja.
SELECT
  (SELECT count(*) FROM meres_kuldes WHERE letrehozva >= :A AND letrehozva < :B) AS kuldes_sorok,
  (SELECT count(*) FROM meres_kuldes WHERE letrehozva >= :A AND letrehozva < :B AND allapot = 'elkuldve') AS elkuldve,
  (SELECT count(*) FROM meres_kuldes WHERE letrehozva >= :A AND letrehozva < :B AND allapot = 'elkuldve' AND (
      (platform = 'meta' AND COALESCE(kerelem,'') NOT LIKE '%28616665324611098%')
   OR (platform = 'tiktok' AND COALESCE(kerelem,'') NOT LIKE '%DB2GTTJC77UE4D1NE4MG%')
   OR (platform = 'google' AND COALESCE(platform_nev,'') NOT LIKE 'ARNYEK-%')
   OR COALESCE(kerelem,'') LIKE '%3473839859576758%' OR COALESCE(kerelem,'') LIKE '%1361403694872594%'
   OR COALESCE(kerelem,'') LIKE '%643342342027957%'  OR COALESCE(kerelem,'') LIKE '%1019878750660854%'
   OR COALESCE(kerelem,'') LIKE '%729596671946533%'  OR COALESCE(kerelem,'') LIKE '%CTDGK5BC77U0PIODKP30%'
   OR COALESCE(kerelem,'') LIKE '%G-H4206SQ0Q7%')) AS elo_celu_elkuldve;

-- 3) Rossz esemenytipus: a foglalas jellege (meres_jelleg) es uzletaga szerint VART alap- es ernyoesemeny
--    (netlify/lib/meres/esemeny-modell.js esemenyek()). jelleg_hianyzik = nem ertekelheto (kulon sor, nem "jo").
WITH k AS (
  SELECT k.*, j.jelleg AS jelleg, j.kupon AS kupon
  FROM meres_kuldes k LEFT JOIN meres_jelleg j ON j.source_id = k.source_id
  WHERE k.letrehozva >= :A AND k.letrehozva < :B AND k.source_id LIKE 'mb_%'
), jo AS (
  SELECT *,
    CASE
      WHEN jelleg IS NULL THEN 'jelleg_hianyzik'
      WHEN esemeny_tipus = 'alap' AND ((jelleg = 'elso' AND esemeny_nev = 'FoglalasElso')
        OR (jelleg = 'konzultacio' AND esemeny_nev = 'Konzultacio' AND uzletag <> 'headspa')
        OR (jelleg = 'visszajaro' AND esemeny_nev = 'Visszajaro')) THEN 'ok'
      WHEN esemeny_tipus = 'ernyo' AND kupon = 0 AND jelleg IN ('elso','konzultacio') AND (uzletag <> 'headspa' OR jelleg = 'elso')
        AND esemeny_nev = (CASE uzletag WHEN 'fodrasz' THEN 'Fodrasz_AkviziciosFoglalas' WHEN 'oxigen' THEN 'Oxigen_AkviziciosFoglalas' ELSE 'Schedule' END) THEN 'ok'
      ELSE 'ROSSZ_TIPUS'
    END AS minosites,
    (esemeny_id <> esemeny_nev || ':' || source_id) AS id_elteres
  FROM k
)
SELECT
  (SELECT count(*) FROM jo) AS vizsgalt_kuldes_sorok,
  (SELECT count(DISTINCT source_id) FROM jo) AS foglalasok,
  (SELECT count(*) FROM jo WHERE minosites = 'ROSSZ_TIPUS') AS rossz_tipus,
  (SELECT count(*) FROM jo WHERE minosites = 'jelleg_hianyzik') AS jelleg_hianyzik_nem_ertekelheto,
  (SELECT count(*) FROM jo WHERE id_elteres) AS esemeny_id_elteres,
  (SELECT count(*) FROM (SELECT source_id FROM jo WHERE esemeny_tipus = 'alap' GROUP BY source_id HAVING count(DISTINCT esemeny_nev) > 1)) AS tobb_alapesemeny_tipus_foglalasonkent;

-- 4) (esemeny_id, platform) duplikacio: az ablakban es a teljes tablaban (a UNIQUE index: meres_kuldes_egyedi).
SELECT
  (SELECT count(*) FROM (SELECT esemeny_id, platform FROM meres_kuldes WHERE letrehozva >= :A AND letrehozva < :B GROUP BY esemeny_id, platform HAVING count(*) > 1)) AS duplikalt_ablak,
  (SELECT count(*) FROM (SELECT esemeny_id, platform FROM meres_kuldes GROUP BY esemeny_id, platform HAVING count(*) > 1)) AS duplikalt_teljes;

-- 5) Felszabadult kulcsok (kulon sor, tajekoztato; nem teves parositas).
SELECT count(*) AS felszabadult FROM foglalas_lemondas WHERE eredmeny = 'felszabadult' AND ido >= :A AND ido < :B;

-- 6) Seman es kill switch (a 'nem valtozott' ellenorzeshez; a kiindulas: 16 objektum, 5 kapcsolo-sor, utolso ido 1791307017).
SELECT type, name, length(sql) AS sql_hossz FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type, name;
SELECT kulcs, be, ok, ido, datetime(ido,'unixepoch') AS ido_utc FROM meres_kapcsolo ORDER BY ido;
