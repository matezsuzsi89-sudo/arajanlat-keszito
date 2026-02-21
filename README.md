# Árajánlat generátor

Next.js (App Router) TypeScript webalkalmazás árajánlatok készítéséhez.

## Telepítés és futtatás

```bash
npm install
npm run dev
```

A böngészőben nyissa meg a [http://localhost:3000](http://localhost:3000) címet.

## Funkciók

- **1. lépés – Cégadatok:** cégnév, cím, telefonszám, adószám, bankszámlaszám, e-mail (opcionális), logó feltöltés
- **2. lépés – Általános megjegyzés:** szövegmező (pl. gyártási idő, fizetési feltételek, érvényesség)
- **3. lépés – Tételek:** tétel neve, megjegyzés, mennyiség, mértékegység, nettó egységár, ÁFA %; tételenkénti nettó és bruttó összeg
- **Összegzés:** nettó részösszeg, ÁFA, bruttó végösszeg; opcionális kedvezmény (%); PDF letöltés

## PDF export

A „PDF letöltése” gomb az árajánlatot PDF-be menti: fejléc logóval, céges adatokkal, mai dátummal, általános megjegyzéssel, tételtáblázattal és összesítéssel (kedvezménnyel, ha van).

## Technológia

- Next.js 14 (App Router), TypeScript, Tailwind CSS, Zod (validáció), jsPDF + jspdf-autotable (PDF)
