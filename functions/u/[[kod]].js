// /u/<kod>: leiratkozas az automatikus e-mailekrol (GET: megerosito oldal, POST: a leiratkozas). Lasd netlify/lib/lifecycle/leiratkozas.js, http.js.
import { leiratkozas } from '../../netlify/lib/lifecycle/http.js';

export const onRequest = (context) => leiratkozas(context.request, context.env);
