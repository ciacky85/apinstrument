# AP Instrument - Handcrafted Mallets & Percussions E-Commerce (v2.0)

E-commerce moderno, responsive ed elegante sviluppato su misura per **AP Instrument**, specializzato nella creazione artigianale di bacchette per percussioni (Marimba, Vibrafono, Xilofono, Glockenspiel e Setup).

Design ispirato all'eleganza sobria e alla consultazione immediata di **MG Mallets**, arricchito da una calda palette naturale che evoca le essenze lignee (Acero, Ulivo, Palissandro), l'artigianalità sartoriale e il Made in Italy.

---

## Caratteristiche Principali

- **Design Moderno & Mobile-First**: Navigazione ad albero per strumento e serie, layout a griglia pulito con schede prodotto interattive, galleria e visualizzatore di specifiche tecniche (peso, bilanciamento, testa, flessibilità, diametro).
- **Integrazione Database & Migrazione Completa**:
  - 127 prodotti pubblicati migrati con risoluzione dei tag multilingua (`qTranslate-X` -> campi bilingue puliti IT / EN).
  - Tutte le immagini di copertina e gallerie collegate.
  - Tassonomie, gerarchia categorie e specifiche tecniche preservate.
  - Storico ordini e clienti archiviato e pronto.
- **E-Commerce & Pagamenti**:
  - Calcolo condizionale delle spese di spedizione (Italia, Europa, Extra UE).
  - Supporto per codice fiscale e Partita IVA al checkout per la fatturazione italiana.
  - Pagamento online tramite **PayPal** e Carte di Credito/Debito oltre a Bonifico Bancario.
- **Multilingua Nativo**: Switcher istantaneo Italiano / Inglese.

---

## Architettura & Containerizzazione Docker

Il progetto è predisposto per l'esecuzione in container isolato su porta esterna **9559** con configurazione esterna su host `/srv/docker_conf/configs/apinstrument`.

### Avvio con Docker Compose

```bash
docker compose up -d --build
```

L'applicazione sarà accessibile su:
```
http://localhost:9559
```

### Struttura Volumi Persistenti

- `/srv/docker_conf/configs/apinstrument/data` -> Database catalogo e ordini (`/app/server/data`)
- `/srv/docker_conf/configs/apinstrument/uploads` -> File multimediali e immagini (`/app/server/public/uploads`)

---

## Sviluppo Locale (senza Docker)

Requisiti: **Node.js 20+**

```bash
npm install
npm start
```
