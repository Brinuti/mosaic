// /api/gy-motor-stat - GY-24 nevtelen lepesenkenti tolcser-szamlalo. A logika: lib/motor-szerver.js (motorStatVegpont). A hiba soha nem akadalyozza a foglalast (204 / 400).
import { motorStatVegpont } from '../../lib/motor-szerver.js';

export const onRequest = async (context) => {
  try { return await motorStatVegpont({ request: context.request, env: context.env }); } catch (e) { return new Response(null, { status: 204 }); }
};
