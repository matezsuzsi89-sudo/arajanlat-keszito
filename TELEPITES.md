# Ajánlat készítő – Online telepítés

Az alkalmazás online elérhetővé tételéhez válassz egy hosztolási szolgáltatást.

---

## 1. Railway (ajánlott – PDF miatt)

A PDF generálás Puppeteerrel történik, ez a Railway-on stabilan működik.

1. Regisztrálj: [railway.app](https://railway.app)
2. „New Project” → „Deploy from GitHub repo”
3. Ha nincs még GitHub repo, hozz létre egyet (lásd az „Előkészítés” részt)
4. A Railway felismeri a Next.js projektet, automatikusan buildel és deployol
5. Kapsz egy linket, pl. `te-projekt.up.railway.app`

---

## 2. Vercel

1. Regisztrálj: [vercel.com](https://vercel.com)
2. „Add New” → „Project” → kapcsold a GitHub repót
3. A Vercel felismeri a Next.js projektet
4. Deploy → kapsz linket

**Figyelem:** A Puppeteer a Vercel serverless környezetben méretkorlátok miatt problémás lehet. Ha a PDF generálás hibát ad, használd inkább a Railway-t.

---

## 3. Render

1. Regisztrálj: [render.com](https://render.com)
2. „New” → „Web Service”
3. Kapcsold a GitHub repót
4. Build command: `npm run build`
5. Start command: `npm start`

---

## 4. Előkészítés (git repo)

Ha még nincs git repository:

```bash
cd "c:\Users\matez\Desktop\általános árajánlat készítő"
git init
git add .
git commit -m "Ajánlat készítő"
```

Majd hozz létre repót a [GitHub.com](https://github.com) oldalon, és add hozzá remote-ként.

---

## Fontos

- **PDF generálás:** A Puppeteer nagy méretű függőség. Ha a Vercelnél hibát kapsz, próbáld a Railway-t vagy a Render-t.
- **Adatok:** Az ajánlatok jelenleg a böngésző localStorage-ban tárolódnak – új eszközön vagy böngészőben nem jelennek meg.
- **Saját domain:** A legtöbb szolgáltatás ingyenes aldomaint ad (pl. `te-projekt.vercel.app`).
