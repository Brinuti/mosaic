// Cloudflare Pages-fuggveny: a foglalas -> megjelenes (booking-to-show) emlekezteto-rendszer vegpontjai. Lasd netlify/lib/lifecycle/http.js, docs/lifecycle/LIFECYCLE.md.
import { api } from '../../../netlify/lib/lifecycle/http.js';

export const onRequest = (context) => api(context.request, context.env, context);
