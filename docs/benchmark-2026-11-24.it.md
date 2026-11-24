# Flight Search MCP · benchmark internazionale

Prima rilevazione il 24 novembre 2026, ora di Roma. Le finestre di **viaggio** restano fisse, 5–7 marzo e 14–18 aprile 2027.

## Ricerca e tempi

La serie principale comprende 24 richieste su 12 rotte e 7 mercati. Parte dall’Italia e usa l’effettivo protocollo MCP. Ogni gruppo contiene quattro richieste concorrenti. Le misure di latenza includono le attese in coda. In 0.4.9 ogni fonte interrogata espone anche il proprio tempo.

Dopo una risposta di limitazione di Skiplagged, la 0.4.8 teneva ferme le richieste in coda. La **0.4.9** osserva i 30 secondi di pausa e, durante la pausa, prosegue subito con i preventivi delle altre fonti. Il test riproduce il caso con due chiamate già in coda, un nuovo tentativo e la riapertura dopo 30 secondi.

| Misura del 24 novembre | 0.4.8 | 0.4.9 |
|---|---:|---:|
| Scenari con almeno un itinerario compatibile | 24/24 | 24/24 |
| Tempo mediano | 50,57 s | 0,80 s |
| Tempo al 90º percentile | 80,57 s | 2,67 s |
| Tempo massimo | 107,91 s | 8,84 s |
| Scenari con risultati Kiwi | 19 | 22 |
| Scenari con risultati Lastminute | 13 | 14 |
| Scenari con risultati Skiplagged | 13 | 1 |
| Scenari con risultati Axel | 3 | 3 |

Confrontando il minimo API di tutte le offerte, nella 0.4.9 otto scenari sono costati di più, due di meno e quattordici sono rimasti uguali. Tutti gli otto minimi più bassi scomparsi erano conversioni Skiplagged. Limitando il confronto ai preventivi in valuta richiesta con link diretto al venditore, 21 minimi sono rimasti uguali e due sono scesi, entrambi di USD 2. Nel caso Tokyo–Taipei di aprile è comparso un preventivo con link diretto. Le esecuzioni sono successive e condividono il limite a monte. La misura descrive il comportamento in questa sessione, con variazioni di inventario e disponibilità della fonte.

Nella serie addizionale solo Kiwi, la 0.4.9 ha trovato itinerari in **16/16** casi, sempre nella valuta richiesta, con mediana di 0,75 s. Gli otto mercati aggiuntivi erano Brasile, Messico, Canada, Sudafrica, India, Emirati Arabi Uniti, Singapore e Nuova Zelanda. [Matrice principale, dati CSV](../benchmarks/2026-11-24-search-matrix.csv)

## Paesi e link pubblici

Il 24 novembre ho fatto 36 richieste HTTP a 6 indirizzi pubblici da sonde in Italia, Regno Unito, Stati Uniti, Brasile, Giappone e Australia. Kiwi ha risposto **200 da tutti e sei**, tra 58 e 380 ms. Le due home di Lastminute, il link pubblico alla rotta Londra–Edimburgo su Skiplagged e l’endpoint Lastminute hanno risposto 403 a queste sonde. L’endpoint MCP di Kiwi ha risposto 406 a un GET privo degli header MCP. I risultati descrivono le richieste automatiche pubbliche. [Globalping](https://globalping.io/docs/api.globalping.io) · [Misura Kiwi](https://api.globalping.io/v1/measurements/2bL1Alv0H1NY0l46r00021Z4N) · [Misura Lastminute](https://api.globalping.io/v1/measurements/2AJcwp9mNQvvOhpbI00021Z4N) · [Misura Skiplagged](https://api.globalping.io/v1/measurements/2pCKdzW8zmPEiKTSe00021Z4N)

Ho avviato anche tre browser remoti su una pagina pubblica. Lo strumento ha mostrato tutte le sessioni in modalità diretta senza proxy durante un disservizio. Ho escluso le tre sessioni dalla verifica geografica dei checkout. [Browserstorm](https://browserstorm.com/)

## Checkout del 24 novembre

Ho riaperto quattro link dei venditori dalla sessione italiana. Le tre coppie usano gli stessi numeri di volo, date, gruppo, classe Economy e configurazione degli extra indicati. Non sono stati inseriti dati dei viaggiatori o di pagamento.

| Volo | Gruppo ed extra | Venditore 1 | Venditore 2 |
|---|---|---:|---:|
| MAD–FCO A/R, W46208 e W46011 | 2 adulti, borsa piccola, niente stiva o posto scelto | **Lastminute €159,96** | Kiwi €166,00 |
| MAD–FCO A/R, W46208 e W46011 | Stesso gruppo, 20 kg per tratta assegnati al primo adulto, niente posto scelto | **Lastminute €315,90** | Kiwi €319,14 |
| LAX–JFK, B6424 | 1 adulto, bagaglio a mano incluso, niente stiva o posto scelto | **Axel USD 204,97** | Kiwi USD 212,00 |

Per Axel ho letto il totale mostrato prima dell’inserimento dei dati del viaggiatore. I dettagli contrattuali delle due tariffe JetBlue erano fuori dal confronto. In una verifica precedente dello stesso giorno, sullo stesso volo Madrid–Roma il bagaglio da 20 kg portava Kiwi a €314,14 e Lastminute a €315,90. Nella nuova rilevazione Kiwi ha aumentato il prezzo base di €5,00 e quindi è cambiato il venditore più economico. [Verifica precedente](benchmark-0.4.8.it.md)

Ho aperto anche il link Skiplagged per Madrid–Roma. La pagina ha mantenuto voli e gruppo, ma mostrava £126,13 e due pulsanti distinti, uno per tratta. Il preventivo iniziale in EUR era una conversione. Ho escluso questo importo dalla graduatoria dei checkout in EUR.

## Confronto con altri MCP

| MCP | Casi con preventivi nella prova | Contesto |
|---|---:|---|
| fli-mcp | 0/14 | Risposta vuota, mediana sotto 0,1 s |
| flights-mcp | 0/12 | Nessun preventivo, mediana 0,36 s. Due ulteriori richieste con bagaglio fuori schema |
| Vuelo | 4/4 | GBP, da 0,41 a 0,81 s. Destinazioni da aeroporti britannici |
| AirTreks | 4/4 | USD, da 0,23 a 0,36 s. Preventivi A/R e open-jaw, pianificatore generico |
| OctoTrip | 0/3 a marzo | Da 11,31 a 24,13 s. La sessione di aprile è andata in timeout durante l’inizializzazione |
| Ryanair | 0/2 | L’endpoint ha esposto due strumenti per aeroporti e rotte. Le chiamate al tool prenotazione documentato hanno restituito “tool not found” |
| Skyscanner ufficiale | Fuori dal confronto sul gruppo | Lo schema live disponibile nella sessione espone date, classe, mercato e valuta. Manca un input per passeggeri ed extra |

I casi dei concorrenti coprono perimetri diversi. Le risposte vuote e i preventivi senza checkout per la stessa configurazione restano fuori dalla graduatoria dei prezzi. [fli-mcp](https://github.com/johnroma/fli-mcp) · [flights-mcp](https://github.com/ricardo-perello/flights-mcp) · [Vuelo](https://getvuelo.com/uk/agent-to-agent/) · [AirTreks](https://airtreks.com/developers) · [OctoTrip](https://github.com/OctoTrip/flights) · [Ryanair](https://services-api.ryanair.com/mcp-server/docs)

Il link Vuelo Londra–Lisbona ha aperto la sua pagina di offerte per due adulti, con £550,79 per TAP TP1369 e TP1368, un bagaglio a mano per passeggero e niente stiva. Il link Kiwi per gli stessi voli ha mostrato £353 nel riepilogo. Vuelo esponeva il prezzo sulla scheda risultati e non indicava il peso del bagaglio a mano, quindi la coppia resta fuori dal confronto al checkout a parità di extra.

## Test del pacchetto

Ho estratto lo ZIP in una cartella pulita e verificato installazione, 86 test superati, 100% di righe, istruzioni, funzioni e rami per ciascun file, 21 mutazioni rilevate, confronto checkout end-to-end e 37 strumenti elencati da Codex.

```sh
npm ci
npm run coverage
npm run test:mutations
node test/checkout-benchmark.mjs
node test/live-market-benchmark.mjs
node test/live-geographic-links.mjs
```

## Perimetro

Questa rilevazione copre un giorno. I checkout documentati provengono da una sessione italiana. Le sonde internazionali misurano i link pubblici. I prezzi di un singolo posto restano da verificare sui venditori.
