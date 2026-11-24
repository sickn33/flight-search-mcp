# Flight Search MCP · guida in italiano

[Home](../README.md) · [Installazione](install.md) · [Tutti gli strumenti](tools.md) · [Benchmark](../BENCHMARK.md)

MCP locale in TypeScript per cercare voli, confrontare offerte per tutto il gruppo e arrivare al checkout del venditore. Licenza MIT. La configurazione predefinita usa quattro MCP pubblici, Skiplagged, Lastminute, Kiwi.com e Axel, senza chiavi, carta o abbonamento.

## Installa in Codex

Richiede Node.js 22.13 o successivo. Nella cartella estratta:

```sh
npm ci
npm run build
codex mcp add flight-search -- node "$(pwd)/dist/index.js"
```

Apri una nuova chat Codex. Per usare il pacchetto plugin con la skill inclusa, il marketplace locale è già nel progetto. Metti `flight-search-mcp` sul PATH di Codex con `npm link` dalla cartella estratta. Quindi usa `codex plugin marketplace add "$(pwd)"` e installa `flight-search@flight-search-local`. Scegli una sola modalità di registrazione.

Prova «Con Flight Search cerca voli Fiumicino–Lione A/R per sei, diretti, partenza venerdì e ritorno domenica dalle 19, per i weekend tra il 5 e il 14 marzo 2027».

## International use

This MCP runs locally with Node.js 22.13 or later. It applies no country
allowlist and the default provider setup needs no key, card, or subscription.
Use `market` for the country of sale and `currency` for the requested price
currency (for example `BR` and `BRL`, or `JP` and `JPY`). If you omit
them, the defaults are Italy and EUR. The market supplies the default
language. Set `locale` to override it where the provider supports it.
Provider inventory, accepted currency, and seller checkout can vary by market.
Buy the ticket on the seller's site.

## Strumenti

| Compito | Strumenti |
| --- | --- |
| Ricerca e verifica | `list_providers`, `search_flights`, `refresh_offer`, `resolve_airport` |
| Flessibilità e gruppi | `compare_weekends`, `compare_airports`, `compare_travel_parties`, `search_split_itinerary`, `quote_airtreks_itinerary`, `explore_dates`, `explore_destinations` |
| Preventivi con accessori | `quote_flights_with_baggage`, `inspect_axel_fare`, `compare_fare_totals`, `compare_checkout_quotes` |
| Prima e dopo la partenza | `get_flight_assistance`, `get_fiumicino_departure_status`, `get_bologna_flight_status`, `get_avinor_flight_status`, `get_songshan_flight_status`, `get_kaohsiung_flight_board`, `get_faa_airport_conditions`, `get_italian_aviation_strikes`, `track_airborne_flight` |
| Prezzi in miglia | `search_awards` |
| Alloggi, auto e pacchetti | `find_stays`, `find_rental_cars`, `find_flight_hotel_packages`, `inspect_stay_or_package`, `get_stay_checkout_link`, `calculate_trip_cost` |
| Calendario | `import_calendar_conflicts`, `export_itinerary_calendar` |
| Ricerche salvate e soglie | `save_price_watch`, `list_price_watches`, `check_price_watch`, `delete_price_watch` |

`search_flights` accetta tratte esplicite, passeggeri, finestre orarie per tratta, massimo scali, compagnie, durata, valuta e budget. `compare_weekends` consente fino a 13 settimane ed esclude date puntuali. `compare_travel_parties` calcola il totale di più prenotazioni distinte quando ha una quotazione comparabile per ogni gruppo. `calculate_trip_cost` somma preventivi nella stessa valuta in unità monetarie minime. Le voci mancanti restano visibili.

Per gli hotel, usa il nome italiano riconosciuto dal servizio e il codice Paese, per esempio `Lione` e `FR`. Il server richiede una corrispondenza esatta. Le offerte hotel e auto rimandano al venditore per prezzo finale, condizioni e capienza. Il calendario accetta il testo di un file ICS e restituisce date da escludere. Il conteggio degli eventi ignorati segnala ricorrenze e fusi nominativi. Le soglie di prezzo sono salvate in SQLite. Il controllo è disponibile da Codex e come processo programmabile. `FLIGHT_STATE_DIR` imposta la directory dei dati.

## Fonti e checkout

- **Skiplagged** supporta A/R, passeggeri e date flessibili. Gli importi espressi in valute diverse dal dollaro sono conversioni indicative. Quando il server pubblico segnala un limite, l’adattatore sospende le richieste a Skiplagged per 30 secondi e restituisce i risultati delle altre fonti disponibili. [Documentazione](https://skiplagged.github.io/mcp/)
- **Lastminute** aggiunge un secondo inventario gratuito da interrogare. L’adattatore sceglie il mercato e la valuta corrispondenti per Italia, Francia e Spagna (EUR) e Regno Unito (GBP). Mantiene il prezzo testuale della fonte e scarta dal risultato i link per un altro mercato. Gli scali senza protezione verificata sono inclusi su richiesta esplicita. Gli orari sono locali. La data di arrivo è marcata come da verificare quando il feed fornisce solo l’orario. [Documentazione](https://technology.lastminute.com/mcp/)
- **Kiwi.com** cerca voli di sola andata e A/R sulla stessa coppia di aeroporti, anche con bagagli richiesti per viaggiatore. La fonte conferma le quantità per l’intero gruppo. Le ricerche con minori accettano età da 2 a 11 anni e i neonati in braccio. [MCP Kiwi.com](https://www.kiwi.com/ko/pages/mcp/)
- **Axel** aggiunge voli diretti quotati in USD per soli adulti, su richieste con mercato US. Per gli A/R con biglietto unico, il server verifica una proposta contro il dettaglio della tariffa e usa il prezzo aggiornato della famiglia verificata. Con `allowSeparateTickets: true` restituisce anche i preventivi dal riepilogo e indica che la struttura del biglietto resta sconosciuta. Il link apre la revisione dell’offerta sul sito Axel. [MCP Axel](https://helloaxel.com/en/ai/api)
- **Skyscanner partner** è facoltativo. La chiave `FLIGHT_SKYSCANNER_KEY` serve solo se hai già un accesso partner e selezioni la fonte esplicitamente. Controlla le condizioni del tuo accordo prima di configurarlo. [Accesso partner](https://www.partners.skyscanner.net/contact/travel-api)

Per acquistare, apri il link del venditore e verifica il totale, i posti disponibili, il bagaglio e le condizioni. Da quel sito gestisci anche il pagamento e l’assistenza post-vendita. Il costo del volo resta quello del venditore.

## Multi-city, costi e assistenza

`quote_flights_with_baggage` interroga Kiwi.com con le quantità desiderate. I risultati indicano `checkoutPriceVerified: false`. Per verificare importo, peso e assegnazione del collo, apri il riepilogo Kiwi prima di pagare.

`compare_checkout_quotes` confronta i totali osservati sul sito quando i due
preventivi coincidono per valuta, mercato, voli, passeggeri, cabina, inclusioni
e accessori per passeggero e segmento. Indica lo scostamento dal preventivo API
e lascia fuori dal ranking le offerte con condizioni diverse o lette nei soli
risultati. Gli importi e i dettagli sono forniti dal chiamante. I link
Skiplagged con `checkoutLinkScope: "seller_options"` aprono la scelta del
venditore e richiedono un ulteriore controllo del preventivo.

Per chiedere un bagaglio da stiva per il primo di due adulti, usa
`allocation: { adultHold: [1, 0] }` insieme alla richiesta di volo. Gli altri
campi sono `adultCabin`, `childHold` e `childCabin`. Ogni voce presente ha
un numero per viaggiatore. L’API restituisce il preventivo di gruppo e il conteggio complessivo dei bagagli. Il checkout del venditore mostra gli eventuali prezzi
per peso e i costi dei posti. Nelle verifiche Kiwi.com ed easyJet mostrano
la selezione dei posti dopo la pagina dei viaggiatori.

`search_split_itinerary` confronta singole tratte per viaggi multi-city e open-jaw.
I link e le tariffe corrispondono a biglietti separati. Verifica compatibilità,
aeroporti e margini tra voli prima di scegliere una coincidenza autonoma.
Il totale è una somma dei voli disponibili in quella ricerca. La fonte
Skyscanner, se già autorizzata, supporta anche la ricerca con più tratte nella
stessa richiesta.

`quote_airtreks_itinerary` chiede ad AirTreks un preventivo per tutto il
gruppo e per un singolo biglietto, incluse tratte con aeroporti diversi tra
l’arrivo e la ripartenza. Restituisce la valuta del fornitore e segnala la
cache recente quando dichiarata. Puoi filtrare il totale degli scali tramite
`maxTotalStops`. Il risultato indica numeri di volo e aeroporti. Gli orari
puntuali vanno controllati sul sito. Il link AirTreks apre il pianificatore
generico, mentre il campo del link diretto al checkout ha valore nullo.
[API AirTreks](https://github.com/Airtreks/airtreks-mcp)

`inspect_axel_fare` legge l’offerta associata a un link Axel. Mostra i
prezzi delle famiglie tariffarie e le voci bagaglio con valuta, fonte e unità
originali. Le condizioni di scelta del posto dipendono dalla famiglia.
L’importo per numero di sedile resta sconosciuto.

`compare_fare_totals` confronta il prezzo totale del gruppo con bagagli e posti
per passeggero e tratta. Inserisci gli extra richiesti anche quando il venditore
non li ha ancora quotati, usando un prezzo nullo. Puoi annotare anche cambio
e rimborso. Il tool usa i preventivi forniti e mostra le voci sconosciute.
I prezzi dinamici degli extra restano da aprire sul checkout del venditore.

`get_flight_assistance` raccoglie i collegamenti ufficiali disponibili per
easyJet, Ryanair e ITA Airways, le bacheche di Fiumicino, Bologna e Lione e i riferimenti
UE. A Fiumicino il tool dedicato legge stato, gate e banco di check-in dalla
bacheca ufficiale quando trova un dettaglio con la stessa data della richiesta.
A Bologna `get_bologna_flight_status` legge arrivi e partenze di oggi e domani.
Mostra stato, orari, gate, check-in e nastro bagagli quando la bacheca li pubblica.
Per gli aeroporti norvegesi gestiti da Avinor, `get_avinor_flight_status` legge
il feed ufficiale per arrivi e partenze. Verifica il giorno locale e il numero
operativo o in codeshare. La finestra della fonte è di 6 ore indietro e 12
avanti, con cache di tre minuti per aeroporto. Orari in UTC.
[Flight data from Avinor](https://www.avinor.no/)

`get_songshan_flight_status` legge i tabelloni di Taipei Songshan (TSA),
arrivi e partenze nazionali e internazionali del giorno a Taipei. Mostra
orario programmato e orario riportato dal tabellone, che può essere una stima,
oltre a stato, gate e motivo del ritardo quando disponibili.
Civil Aeronautics Administration, MOTC (Taiwan), dati adattati secondo la
[Open Government Data License 1.0](https://data.gov.tw/license).

Per Kaohsiung (KHH), `get_kaohsiung_flight_board` legge arrivi e partenze
nazionali e internazionali. Verifica che l’istantanea sia stata pubblicata
nella stessa data locale richiesta. Le righe non espongono la propria data.
Mostra orario locale, stato, gate e check-in quando disponibili.
Dati adattati da Kaohsiung International Airport, Civil Aeronautics Administration.
[Portale open data KHH](https://www.kia.gov.tw/opendata.html) · [Licenza](https://data.gov.tw/license)

`get_faa_airport_conditions` interroga gli avvisi correnti della FAA per un
aeroporto statunitense. Leggi motivazione, orari e perimetro di ogni avviso,
poi verifica il singolo volo con il vettore.
[FAA National Airspace System](https://nasstatus.faa.gov/)

`get_italian_aviation_strikes` legge gli avvisi del Ministero delle Infrastrutture
e dei Trasporti nell’intervallo richiesto, estremi inclusi. Include gli scioperi
generali se il testo coinvolge esplicitamente il settore aereo e segnala quando
la data del feed non è verificabile. Per l’operatività di un volo specifico,
consulta la compagnia. Dati selezionati e adattati dal calendario MIT.
[Calendario italiano degli scioperi](https://scioperi.mit.gov.it/mit2/public/scioperi) · [Scheda open data](https://www.dati.gov.it/node/view-dataset/dataset?id=2f3ef05b-27b9-459b-8380-d2ffa0fe3f98)

Usa il numero del volo, la data e la compagnia che lo opera. Gate, ritardi
e cancellazioni si verificano presso compagnia o aeroporto.
`track_airborne_flight` usa il nominativo ICAO operativo, per esempio
`EZY4414`, per cercare una posizione ADS-B osservata. L'assenza di segnale
non dice se un volo è cancellato. [ADS-B](https://api.adsb.lol/docs) · [Diritti UE](https://europa.eu/youreurope/citizens/travel/passenger-rights/air/)

## Avvisi locali di prezzo

Salva una soglia con `save_price_watch`. Per eseguire una sessione di controllo
con le stesse impostazioni del server, usa:

```sh
node dist/index.js --poll-price-alerts
```

Il comando emette JSON quando una quotazione passa sotto la soglia. Su macOS
puoi aggiungere `--notify-macos` per la notifica del sistema. Per programmare
due controlli al giorno, genera e carica l’agente locale dalla cartella
definitiva del progetto:

```sh
mkdir -p "$HOME/Library/LaunchAgents"
node dist/index.js --print-macos-launch-agent > "$HOME/Library/LaunchAgents/org.flight-search.price-alerts.plist"
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/org.flight-search.price-alerts.plist"
```

I controlli partono con il Mac acceso e una sessione utente attiva. Per
disattivarli, usa `launchctl bootout "gui/$(id -u)/org.flight-search.price-alerts"`.
Le tue ricerche salvate restano in SQLite.

## Verifica

`npm run coverage` richiede il 100% di righe, istruzioni, funzioni e rami di ogni file sorgente. I test deterministici girano offline. `npm run test:mutations` verifica che i test intercettino errori deliberati nei filtri, nei costi e nella risoluzione delle città. Dopo il build, `node test/live-benchmark.mjs` esegue il collaudo Roma–Lione attraverso il server MCP. Le variabili `FLIGHT_BENCH_START`, `FLIGHT_BENCH_END`, `FLIGHT_BENCH_ORIGIN` e `FLIGHT_BENCH_DESTINATION` permettono di cambiare caso. `node test/live-competitive.mjs` esegue anche il confronto su quattordici scenari e restituisce il rapporto JSON. La copertura della ricerca include `elapsedMs` per ogni fonte interrogata, compreso il tempo trascorso in coda. `node test/live-geographic-links.mjs` misura la risposta HTTP degli indirizzi pubblici da più Paesi con Globalping. Le sonde pubbliche non ricevono link di checkout.
