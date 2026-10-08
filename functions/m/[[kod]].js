// /m/<kod>: egykattintasos idopont-megerosites (az SMS-ekbol). Lasd netlify/lib/lifecycle/http.js.
import { megerosites } from '../../netlify/lib/lifecycle/http.js';

export const onRequest = (context) => megerosites(context.request, context.env);
