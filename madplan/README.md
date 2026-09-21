# Vangsted Madplan

Mobilvenlig madplan til Cloudflare Pages med Pages Functions og D1 til en delt indkøbsliste.

## Cloudflare Pages
- Root directory: `madplan`
- Build command: `exit 0`
- Build output directory: `public`
- Production branch: `main`

## D1
Opret en D1-database, kør `schema.sql`, og tilføj en D1 binding i Pages-projektet med variabelnavnet `DB`.

## Ugentlig opdatering
`public/data/madplan.json` er den eneste fil, der behøver at blive opdateret hver søndag. Cloudflare laver derefter automatisk en ny deployment.

Indkøbsafkrydsninger gemmes i D1 og synkroniseres hvert 2. sekund mellem enheder.