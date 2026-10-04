// Node resolve-hook az adapter-tesztekhez: a 'nodemailer' es a 'worker-mailer' csomag helyett
// csonkot ad (a csomagok nincsenek telepitve, es a teszt ne kuldjon valodi levelet). A csonkok a
// globalThis.__ajandekLevelek tombbe gyujtik a "kikuldott" leveleket.
const CSONKOK = {
  nodemailer: `export default { createTransport: (o) => ({ sendMail: async (m) => { (globalThis.__ajandekLevelek ||= []).push({ csomag: 'nodemailer', beallitas: o, ...m }); } }) };`,
  'worker-mailer': `export class WorkerMailer {
    static async connect(o) {
      return {
        send: async (m) => { (globalThis.__ajandekLevelek ||= []).push({ csomag: 'worker-mailer', beallitas: o, ...m }); },
        close: async () => { (globalThis.__ajandekZarasok ||= []).push(o.host); },
      };
    }
  }`,
};

export async function resolve(specifier, context, next) {
  if (Object.prototype.hasOwnProperty.call(CSONKOK, specifier)) {
    return { url: 'data:text/javascript,' + encodeURIComponent(CSONKOK[specifier]), shortCircuit: true };
  }
  return next(specifier, context);
}
