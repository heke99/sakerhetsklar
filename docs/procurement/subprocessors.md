# Underbiträden och underleverantörer — register

Registret anpassas per deployment. Standarduppsättning för Model A/B:

| Underbiträde | Tjänst | Region | Roll |
| --- | --- | --- | --- |
| Supabase (eller motsvarande managed Postgres) | Databas, autentisering, fillagring | EU-region enligt kundval | Datalagring |
| Molnleverantör för applikationsdrift (t.ex. Vercel/egen drift) | Applikationshosting | EU-region enligt kundval | Applikationsdrift |
| E-postleverantör (transaktionsmail) | Notifieringar | EU | Utskick |

Model C (kundägd datamiljö): kunden väljer och äger samtliga
datalagringsleverantörer; leverantören av Säkerhetsklar är inte underbiträde för
datalagringen.

Förändringar i registret aviseras i förväg enligt PUB-avtalet. Det aktuella,
kundspecifika registret genereras i upphandlingspaketet under `/app/procurement`.
