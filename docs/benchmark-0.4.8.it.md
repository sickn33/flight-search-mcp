# Flight Search MCP 0.4.8 · benchmark internazionale

Esecuzione del 24 novembre 2026. Le richieste coprono due finestre di viaggio, 5–7 marzo e 14–18 aprile 2027. Le verifiche del checkout sono state svolte da una sessione in Italia, usando i link e le valute richiesti per ciascun mercato.

## Ricerca e copertura

La 0.4.7 ha trovato offerte compatibili in **24/24** scenari su 12 rotte e 7 mercati, con mediana di 40.64 s. Ai quattro MCP a monte ho applicato gli stessi filtri normalizzati. Kiwi 22/24, Lastminute 8/24, Skiplagged 12/24 e Axel 3/24. La copertura del singolo provider include il suo perimetro e gli errori osservati.

Lastminute è passato da 0 a **6/8** scenari nei tre mercati appena abilitati. La 0.4.8 è stata inoltre provata con Kiwi in otto mercati aggiuntivi su due date, con offerte nella valuta richiesta in **16/16** scenari. Queste due serie misurano rispettivamente l’adattatore modificato e la ricerca internazionale con un solo provider.

| Partenza | Mercato | Rotta | Kiwi 0.4.7 | Lastminute 0.4.7 | Skiplagged 0.4.7 | Axel 0.4.7 | Lastminute 0.4.8 |
|---|---|---|---:|---:|---:|---:|---:|
| 2027-03-05 | AU | SYD–MEL | AUD 152.00 | fuori supporto | AUD 115.95 † | fuori supporto | — |
| 2027-03-05 | ES | BCN–AMS | EUR 65.00 | fuori supporto | limite richieste | fuori supporto | EUR 64.00 |
| 2027-03-05 | FR | CDG–FCO | EUR 1091.00 | fuori supporto | limite richieste | fuori supporto | — |
| 2027-03-05 | GB | LHR–EDI | — | fuori supporto | GBP 71.09 † | fuori supporto | GBP 70.67 |
| 2027-03-05 | GB | LHR–LIS | GBP 402.00 | fuori supporto | GBP 347.04 † | fuori supporto | GBP 360.06 |
| 2027-03-05 | IT | FCO–LYS | EUR 172.00 | EUR 162.08 | EUR 122.37 † | fuori supporto | — |
| 2027-03-05 | IT | MAD–FCO | EUR 150.00 | EUR 159.96 | EUR 137.90 † | fuori supporto | — |
| 2027-03-05 | IT | MXP–BCN | EUR 133.00 | EUR 161.94 | limite richieste | fuori supporto | — |
| 2027-03-05 | IT | NAP–CDG | EUR 256.00 | EUR 240.85 | limite richieste | fuori supporto | — |
| 2027-03-05 | JP | NRT–TPE | JPY 87352.00 | fuori supporto | limite richieste | fuori supporto | — |
| 2027-03-05 | US | JFK–LHR | USD 2326.00 | fuori supporto | USD 1323.00 | USD 1365.00 | — |
| 2027-03-05 | US | LAX–JFK | USD 235.00 | fuori supporto | limite richieste | USD 205.00 | — |
| 2027-04-14 | AU | SYD–MEL | AUD 109.00 | fuori supporto | limite richieste | fuori supporto | — |
| 2027-04-14 | ES | BCN–AMS | EUR 84.00 | fuori supporto | limite richieste | fuori supporto | EUR 77.20 |
| 2027-04-14 | FR | CDG–FCO | EUR 451.00 | fuori supporto | limite richieste | fuori supporto | EUR 468.06 |
| 2027-04-14 | GB | LHR–EDI | — | fuori supporto | GBP 72.62 † | fuori supporto | GBP 72.87 |
| 2027-04-14 | GB | LHR–LIS | GBP 536.00 | fuori supporto | GBP 473.17 † | fuori supporto | — |
| 2027-04-14 | IT | FCO–LYS | EUR 346.00 | EUR 327.52 | EUR 273.05 † | fuori supporto | — |
| 2027-04-14 | IT | MAD–FCO | EUR 209.00 | EUR 195.96 | limite richieste | fuori supporto | — |
| 2027-04-14 | IT | MXP–BCN | EUR 147.00 | EUR 140.67 | limite richieste | fuori supporto | — |
| 2027-04-14 | IT | NAP–CDG | EUR 109.00 | EUR 101.85 | EUR 102.28 † | fuori supporto | — |
| 2027-04-14 | JP | NRT–TPE | JPY 107615.00 | fuori supporto | limite richieste | fuori supporto | — |
| 2027-04-14 | US | JFK–LHR | USD 1694.00 | fuori supporto | USD 1420.00 | — | — |
| 2027-04-14 | US | LAX–JFK | USD 203.00 | fuori supporto | USD 199.00 | USD 205.00 | — |

† Prezzo convertito. Le celle sono preventivi API e dipendono dall’inventario disponibile nel momento della chiamata.

## Mercati extraeuropei aggiuntivi

| Mercato | Rotta | 5 marzo | 14 aprile |
|---|---|---:|---:|
| AE | DXB–MCT | AED 335.00 | AED 335.00 |
| BR | GRU–GIG | BRL 362.00 | BRL 348.00 |
| CA | YYZ–YVR | CAD 167.00 | CAD 166.00 |
| IN | DEL–BOM | INR 14723.00 | INR 14962.00 |
| MX | MEX–CUN | MXN 2672.00 | MXN 4172.00 |
| NZ | AKL–CHC | NZD 75.00 | NZD 85.00 |
| SG | SIN–BKK | SGD 550.00 | SGD 366.00 |
| ZA | JNB–CPT | ZAR 1800.00 | ZAR 1800.00 |

## Checkout osservati

Ho aperto 19 link. Nei confronti tra due venditori ho verificato numeri di volo, orari, gruppo e bagagli selezionati. I totali sono prima del pagamento. Dove il sito mostra solo la categoria del minore, ho usato la stessa età nella richiesta e verificato la categoria Bambino sulla pagina. Cambio e rimborso sono fuori dal confronto. I checkout Lastminute avviati da link GB, FR ed ES hanno mostrato una pagina in italiano nella sessione usata, conservando valuta e totale. Il test non attesta una vendita localizzata identica da un IP estero.

| Rotta e voli | Gruppo e configurazione | Lastminute sito | Kiwi sito |
|---|---|---:|---:|
| Madrid–Roma 5–7 mar, W4 6208 / W4 6011 | 2 adulti, borsa piccola | **€159,96** | €161,00 |
| Madrid–Roma 5–7 mar, W4 6208 / W4 6011 | 2 adulti, stesso collo da 20 kg A/R per il primo adulto | €315,90 | **€314,14** |
| Milano–Barcellona 5–7 mar, FR 270 / FR 7539 | 2 adulti e 1 bambino, borsa piccola | **€161,94** | €176,00 |
| Londra–Lisbona 5–7 mar, TP 1369 / TP 1364 | 2 adulti, borsa piccola e trolley, niente stiva | £407,86 | **£402,00** |
| Parigi–Roma 14–18 apr, AZ 317 / AZ 332 | 2 adulti, borsa piccola e trolley da 8 kg | €468,06 | **€453,00** |
| Barcellona–Amsterdam 14 apr, KL 1520 | 2 adulti, borsa piccola | **€77,20** | €84,00 |

Nel caso Parigi–Roma, Kiwi mostrava €451 via MCP ed €453 sul sito. Gli altri prezzi base di questa tabella coincidevano con i rispettivi preventivi API. Il confronto con 20 kg proviene dai due riepiloghi dove ho selezionato lo stesso extra. Ho poi rimosso le selezioni di prova. Nessun acquisto, ordine o preautorizzazione richiesta.

| Controlli singoli aggiuntivi | Preventivo API | Totale sul sito |
|---|---:|---:|
| Kiwi Los Angeles–New York, AA 30 | USD 220,00 | USD 219,42 |
| Axel New York–Londra A/R, riepilogo Basic Economy | USD 1.365,00 | USD 1.364,75 |
| Kiwi Tokyo–Taipei A/R, GK 11 / GK 12 | JPY 115.670 | JPY 115.670 |
| Kiwi Sydney–Melbourne, JQ 527 | AUD 143,00 | AUD 142,99 |
| Kiwi San Paolo–Rio, LA 3874 | BRL 362,00 | BRL 362,01 |
| Kiwi Johannesburg–Città del Capo, 4Z 931 | ZAR 1.800,00 | ZAR 1.800,03 |
| Kiwi Delhi–Mumbai, IX 1056 | INR 14.723,00 | INR 14.722,85 |
| Kiwi Dubai–Mascate, WY 624 | AED 335,00 | AED 335,02 |
| Kiwi Auckland–Christchurch, JQ 247 | NZD 75,00 | NZD 74,99 |

Questi controlli singoli attestano l’apertura del riepilogo e il totale mostrato nella valuta indicata. Per Axel ho osservato il riepilogo collegato alla quotazione e non una coppia di offerte con gli stessi extra.

## Altri MCP

- **fli-mcp**. 0/14 richieste con itinerari prezzati nei due periodi.
- **flights-mcp**. 0/12 richieste con itinerari prezzati nei due periodi.
- **Vuelo**. 4/4 ricerche UK hanno restituito offerte live (9, 5, 10, 12 offerte). Valuta GBP. La prova non ha usato funzioni di prenotazione.
- **AirTreks**. 4/4 preventivi USD su richieste A/R e open-jaw. AirTreks espone un pianificatore generico, quindi il suo prezzo resta fuori dal confronto al checkout.

I casi indipendenti non hanno una matrice comune. Sono confronti aggiuntivi sul perimetro di ciascun server. [fli-mcp](https://github.com/johnroma/fli-mcp) · [flights-mcp](https://github.com/ricardo-perello/flights-mcp) · [Vuelo](https://getvuelo.com/uk/agent-to-agent/) · [AirTreks](https://airtreks.com/developers)

## Correzioni e riproduzione

Lastminute ora interroga UK/GBP, ES/EUR e FR/EUR oltre a IT/EUR. Il server interpreta orari e scali localizzati, controlla la valuta della risposta e conserva il link del mercato atteso. Kiwi e Skyscanner usano per impostazione predefinita la lingua del mercato richiesto, con override esplicito. Il server locale non applica limiti geografici. Inventario, accesso al venditore e certificazione sul singolo posto restano funzioni delle fonti disponibili.

Le due date di partenza sono riproducibili con gli script dell’archivio. Per i checkout apri le offerte corrispondenti agli stessi numeri di volo e verifica il gruppo e il totale prima di inserire dati o pagare. Prezzi, link e disponibilità possono cambiare.

```sh
npm ci
npm run coverage
npm run test:mutations
node test/live-market-benchmark.mjs
FLIGHT_BENCH_MARKETS=GB,ES,FR FLIGHT_BENCH_PROVIDER=lastminute node test/live-market-benchmark.mjs
FLIGHT_BENCH_PROFILE=world FLIGHT_BENCH_PROVIDER=kiwi node test/live-market-benchmark.mjs
node test/live-vuelo-benchmark.mjs
```
