#!/bin/bash
# Egy valodi probafoglalas (probafoglalas.mjs --kuld) + azonnali lemondas (lemond.mjs); a kivonat: kimenet/probafoglalasok-kivonat.jsonl
#   PROBA_EMAIL=<olvashato cim> tools/motor-proba/proba-futtat.sh --nev=3 --hely=12169 --szolg=133236 [--mobil] [--honnan=/migren-piercing]
D=$(cd "$(dirname "$0")" && pwd); KI=${KI:-$D/kimenet}; mkdir -p "$KI"
BASE=${BASE:-https://www.medicalpiercing.hu} KI="$KI" timeout 280 node "$D/probafoglalas.mjs" "$@" --kuld > "$KI/proba-$$.json" 2>&1
node -e '
const fs=require("fs");const s=fs.readFileSync(process.argv[1],"utf8");let j;try{j=JSON.parse(s.slice(s.indexOf("{")))}catch(e){console.log("HIBA, nyers:",s.slice(-1500));process.exit(1)}
const api=j.api.map(a=>{const t=JSON.parse(a.torzs);return {keret:a.keret,booking_id:t.p&&t.p.booking_id}});
const bid=(new URL(j.koszonoUrl)).searchParams.get("booking_id");const back=new URL(j.adatlap).searchParams.get("back");
let bj={};try{bj=JSON.parse(j.kuldesValasz.torzs).booking||{}}catch(e){}
const out={nev:j.nev,nezet:j.nezet,hely:j.hely,szolg:j.szolgNev,ido:j.ido&&j.ido.szoveg,salonicFoglalas:bj.id,ar:bj.priceTotal,salonicUuid:j.salonicUuid,back,koszonoBookingId:bid,egyezik:bid===back,atadva:j.atadva,koszonoUt:new URL(j.koszonoUrl).pathname,api,ga4Inditas:j.foglalasInditasGA4,jsHibak:j.hibak.length,lemondoUrl:j.lemondoUrl};
console.log(JSON.stringify(out));fs.appendFileSync(process.argv[2],JSON.stringify(out)+"\n");' "$KI/proba-$$.json" "$KI/probafoglalasok-kivonat.jsonl"
URL=$(node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");const m=s.match(/"lemondoUrl": "([^"]+)"/);console.log(m?m[1]:"")' "$KI/proba-$$.json")
if [ -n "$URL" ]; then timeout 120 node "$D/lemond.mjs" "$URL"; else echo "NINCS LEMONDO URL - a foglalast kezzel ellenorizd!"; fi
