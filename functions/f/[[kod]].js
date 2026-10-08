// /f/<kod>: a vendeg foglalasi oldalara (Salonic) iranyito rovid link az SMS-ekhez / e-mailekhez. Lasd netlify/lib/lifecycle/http.js.
import { reszletek } from '../../netlify/lib/lifecycle/http.js';

export const onRequest = (context) => reszletek(context.request, context.env);
