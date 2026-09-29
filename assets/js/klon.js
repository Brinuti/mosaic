// A Wix sajat szkriptjei helyett ez a fajl adja vissza az oldal viselkedeset.
//
// Nem ujraertelmezi a mukodest: pontosan azokat az osztalyokat es attributumokat
// allitja, amiket az eles oldalon a Wix JS-e allit. Az eles oldalon megmert
// allapotok:
//
//   mobil menu nyitva : MENU_AS_CONTAINER      data-undisplayed="false" + I_VSKP
//                       MENU_AS_CONTAINER_TOGGLE  + d0L2ow
//                       a benne levo .vlJDcR      + d0L2ow
//                       a benne levo .pp3XSB      + sqDofR   (hamburgerbol X)
//                       aria-label: "Navigációs menü bezárása"
//   mobil almenu nyitva: a <li>                 + rErQ82, a gombon aria-expanded="true"
//   asztali legordulo  : az itemWrapper         data-hovered="true" data-shown="true"
//                       a positionBox           style="margin-top: -4px;"
//
// Gorgetesi vagy belepo animaciot szandekosan nem ad hozza semmihez.
(function () {
  'use strict';

  // --- 1. mobil menu --------------------------------------------------
  const menu = document.getElementById('MENU_AS_CONTAINER');
  const kapcsolo = document.getElementById('MENU_AS_CONTAINER_TOGGLE');
  if (menu && kapcsolo) {
    const ikon = kapcsolo.querySelector('.pp3XSB');
    const doboz = kapcsolo.querySelector('.vlJDcR');
    const CIMKE = { nyit: 'Navigációs menü megnyitása', zar: 'Navigációs menü bezárása' };

    const allit = (nyitva) => {
      menu.setAttribute('data-undisplayed', nyitva ? 'false' : 'true');
      menu.classList.toggle('I_VSKP', nyitva);
      kapcsolo.classList.toggle('d0L2ow', nyitva);
      if (doboz) doboz.classList.toggle('d0L2ow', nyitva);
      if (ikon) ikon.classList.toggle('sqDofR', nyitva);
      kapcsolo.setAttribute('aria-label', nyitva ? CIMKE.zar : CIMKE.nyit);
    };
    const valt = () => allit(menu.getAttribute('data-undisplayed') !== 'false');

    kapcsolo.addEventListener('click', valt);
    kapcsolo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); valt(); }
    });
    const fatyol = document.getElementById('overlay-MENU_AS_CONTAINER');
    if (fatyol) fatyol.addEventListener('click', () => allit(false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') allit(false); });
  }

  // --- 2. mobil menu lenyilo almenui ----------------------------------
  for (const gomb of document.querySelectorAll('[data-testid="expandablemenu-toggle"]')) {
    gomb.addEventListener('click', (e) => {
      e.preventDefault();
      const tetel = gomb.closest('li');
      if (!tetel) return;
      const nyitva = !tetel.classList.contains('rErQ82');
      tetel.classList.toggle('rErQ82', nyitva);
      gomb.setAttribute('aria-expanded', String(nyitva));
    });
  }

  // --- 3. asztali vizszintes menu legordulo elemei --------------------
  // A Wix a legordulot ra-allassal nyitja. A CSS-ben van :hover szabaly is, de az
  // csak a megamenu-valtozatra vonatkozik, a mi menunket az attributumok nyitjak.
  for (const tetel of document.querySelectorAll('[data-testid="menuItemDepth0"]')) {
    const doboz = tetel.querySelector('[class*="__positionBox"]');
    if (!doboz) continue;

    const mutat = (be) => {
      if (be) {
        tetel.setAttribute('data-hovered', 'true');
        tetel.setAttribute('data-shown', 'true');
        doboz.style.marginTop = '-4px';
      } else {
        tetel.removeAttribute('data-hovered');
        tetel.removeAttribute('data-shown');
        doboz.removeAttribute('style');
      }
    };

    tetel.addEventListener('mouseenter', () => mutat(true));
    tetel.addEventListener('mouseleave', () => mutat(false));
    // billentyuzettel is elerheto legyen
    tetel.addEventListener('focusin', () => mutat(true));
    tetel.addEventListener('focusout', (e) => {
      if (!tetel.contains(e.relatedTarget)) mutat(false);
    });
    const gomb = tetel.querySelector('.itemShared2352141355__accessibilityIcon');
    if (gomb) gomb.addEventListener('click', (e) => {
      e.preventDefault();
      mutat(tetel.getAttribute('data-shown') !== 'true');
    });
  }
})();
