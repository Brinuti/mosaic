# Csapdák és tanulságok

- Node 22: `node --test crm/test/` könyvtár-forma nem működik → glob `crm/test/*.test.mjs`.
- UI-teszt mappában `*.mjs` glob elindítja a `teszt-szerver.mjs`-t és beragad.
- Chromium az ügynök-proxyn át ingadozik (`ERR_TOO_MANY_RETRIES`) → újrapróbálás, vagy helyi teszt-szerver.
- `pkill -f` a saját parancs mintájával megöli a shellt → PID-del lőj.
- Bash `grep`-et egyszer tévesen blokkolta az auto-mód osztályozó → Grep eszköz.
- `/crm` fejléceit a függvény adja (a `_headers` nem érvényes, mert a lapot a function szolgálja ki).
- Új API-végpont → vedd fel a `crm/test/api-rbac.test.mjs` táblába; a `hozzarendel` kezelőben `c.kot` kell a body-parse előtt.
- Meglévő kép újrafeltöltése 409 → használd a `csere=1` hívást (UI már így tesz).
- `toltes(hely,…)` kiüríti a varázsló tartalmát → közvetlen try/await.
- Első előnézeti hívás 500 lehet (lusta migráció / hidegindítás) → újrapróba; előnézeten a hiba részlete látszik (`CRM_DEMO=1`).
- A Salonic nem ad API-t; csak értesítő e-mail. A hozzájárulás/hírlevél jelölőnégyzet nem jut át.
- Drive: a MEMORY.md index fájlt a rendelkezésre álló eszközzel nem lehet szerkeszteni → az indexsort kézzel kell hozzáadni (lásd ATADAS.md).
