# Analisi Strutturale del Sito Web (AP Instrument)

Questa analisi delinea l'infrastruttura, lo stack tecnologico e le personalizzazioni del sito web "AP Instrument", dedotte dai file e dal database di progetto. L'obiettivo è fornire un quadro chiaro per una successiva migrazione, refactoring o sviluppo da parte dell'Intelligenza Artificiale.

## 1. Panoramica Tecnologica
- **Piattaforma Base**: WordPress.
- **E-commerce**: WooCommerce.
- **Hosting di Provenienza**: SiteGround (evidente dalle direttive nel `wp-config.php`).
- **Prefisso Database**: `wpapinst_` (configurato in `wp-config.php`).

## 2. Tema e Frontend
- **Tema Attivo**: `shop-isle`.
- **Tema Fallback/Backup**: `twentytwentyfive`.
- **Child Theme**: Non sembra esserci un child theme tradizionale. Le personalizzazioni core non sono state inserite nel `functions.php` del tema, ma saggiamente delegate a plugin personalizzati ad-hoc, garantendo che gli aggiornamenti del tema non sovrascrivano il codice custom.

## 3. Page Builder & Visual Design
L'interfaccia e l'impaginazione sembrano basarsi su un approccio ibrido, sebbene uno prevalga nettamente:
- **Elementor & Elementor Pro**: L'editor visuale principale utilizzato per la costruzione dei layout.
- **WPBakery Page Builder (`js_composer`)**: Presente nell'elenco plugin. Potrebbe essere un residuo di una configurazione precedente, del tema originale o utilizzato per elementi molto specifici.
- **Slider Revolution (`revslider`)**: Utilizzato per slider animati e banner dinamici.

## 4. Architettura E-commerce (WooCommerce)
Il sito non è solo un sito vetrina, ma un vero e proprio **E-commerce completamente funzionale**, strutturato su WooCommerce e integrato profondamente nel database e nei plugin.

### 4.1 Gestione Ordini e Clienti
- Le transazioni sono registrate nelle tabelle dedicate di WooCommerce (es. `wpapinst_wc_orders`, `wpapinst_wc_order_addresses`, `wpapinst_wc_order_operational_data`), separando nettamente i dati degli ordini da quelli dei classici post di WordPress per garantire migliori performance.
- È presente un sistema di lookup e statistiche sugli ordini e sui clienti (`wpapinst_wc_order_stats`, `wpapinst_wc_customer_lookup`), essenziale per dashboard e reportistica di vendita.

### 4.2 Sistemi di Pagamento (Gateway)
Il sito è predisposto per ricevere pagamenti online. Dai plugin attivi risultano configurati sistemi basati su PayPal:
- `woocommerce-paypal-payments`
- `woocommerce-gateway-paypal-express-checkout`
Questo permette al sito di processare transazioni tramite carte di credito, carte di debito e conti PayPal. Le informazioni crittografate sui token di pagamento sono supportate dal DB (`wpapinst_woocommerce_payment_tokens`).

### 4.3 Logistica, Spedizioni e Tassazione
- **Spedizioni Avanzate**: Viene utilizzato il plugin `woocommerce-advanced-shipping`, che permette di impostare regole di spedizione condizionali complesse (es. in base a peso, volume, CAP o nazione del cliente).
- **Zone di Spedizione**: Il database mostra la struttura completa per la gestione territoriale delle spedizioni (`wpapinst_woocommerce_shipping_zones`, `wpapinst_woocommerce_shipping_zone_locations`).
- **Tasse e Fatturazione Italia**: Il sito è specificamente configurato per il mercato e la fiscalità italiana tramite il plugin `woo-piva-codice-fiscale-e-fattura-pdf-per-italia`. Questo gestisce la richiesta di Partita IVA / Codice Fiscale in fase di checkout e la conseguente generazione delle fatture in formato PDF, interfacciandosi con le aliquote fiscali impostate nel DB (`wpapinst_woocommerce_tax_rates`).

## 5. Sistema Multilingua (Punto Critico)
- **Tecnologia**: `qtranslate-x` (con compatibilità estesa da `qtranslate-xt`).
- **Metodologia**: Questo plugin gestisce le traduzioni in-line nel database utilizzando shortcode o tag speciali (es. `[:it]Testo[:en]Text`).
- ⚠️ **Nota per lo sviluppo**: Poiché qTranslate-X è deprecato da anni, la migrazione a un sistema moderno (come WPML o Polylang) richiederà una pulizia e un parsing massivo del database per estrarre le stringhe di testo grezze intrappolate nei tag delle lingue.

## 6. Plugin Personalizzati (Sviluppo Ad Hoc)
Sono presenti due plugin custom fondamentali che estendono le logiche core del sito:

### 6.1 `ap-customization`
Plugin che gestisce la logica SEO personalizzata, creando un ponte tra qTranslate-X e Yoast SEO.
- **Funzionalità Meta Box**: Aggiunge campi personalizzati (SEO Title e SEO Description) sia per l'Italiano che per l'Inglese (es. `ap_seo_title`, `ap_seo_title_en`) nell'editor di post, pagine e prodotti.
- **Override Yoast SEO**: Utilizza gli hook `wpseo_title` e `wpseo_metadesc` per forzare l'output di Yoast SEO. Legge la lingua corrente tramite `qtranxf_getLanguage()` e inietta il tag title e la meta description dal campo personalizzato corrispondente, concatenando dinamicamente " - AP Instrument".

### 6.2 `ap-elementor-widgets`
Plugin che estende Elementor per i prodotti WooCommerce.
- **Widget Custom**: Registra due widget Elementor specifici per l'infrastruttura del sito:
  - `AP_Preview_Product_Woocommerce`
  - `AP_Horizontal_Product_Woocommerce`

## 7. Stack Plugin Rilevanti
Oltre ai core, l'installazione impiega svariati plugin commerciali e gratuiti per coprire diverse aree funzionali:
- **SEO & Ricerca**: 
  - `wordpress-seo` (Yoast) 
  - `ajax-search-pro` (Motore di ricerca interno avanzato)
- **E-commerce Extensions**: 
  - `woo-piva-codice-fiscale-e-fattura-pdf-per-italia` (Fatturazione IT)
  - Moduli per PayPal, export e advanced shipping.
- **Performance & Media**: 
  - `wp-super-cache` (Caching delle pagine)
  - `wp-smushit` (Ottimizzazione immagini)
- **Sicurezza e Gestione**: 
  - `wordfence` (Firewall e sicurezza)
  - `updraftplus` / `backwpup` (Sistemi di backup)
  - `redirection` (Gestione redirect 301)
  - `cookie-notice` (Compliance GDPR)
  - `mainwp-child` (Collegato a un pannello MainWP per la gestione centralizzata)

## 8. Valutazione Strutturale del Database (In vista del Nuovo Sito)
Osservando le tabelle generate dall'SQL dump (`apinstrument_280926_db.sql`), il passaggio a un nuovo sito (sia che rimanga su WordPress, sia che passi ad altro CMS) presenterà delle sfide strutturali che l'IA dovrà affrontare:

### 8.1 "Bloatware" e Tabelle da scartare
Il database è appesantito da tabelle di log storici e plugin di sicurezza che **non dovranno** essere migrate nel nuovo sito per mantenere il DB pulito e performante:
- **Wordfence**: Oltre 15 tabelle dedicate a log di sicurezza e hit (`wpapinst_wfhits`, `wpapinst_wffilechanges`, `wpapinst_wflogins`, ecc.).
- **Action Scheduler**: `wpapinst_actionscheduler_actions` e `wpapinst_actionscheduler_logs` contengono task passati generati da WooCommerce.
- **Cache & Statistiche**: `wpapinst_ajaxsearchpro_statistics`, tabelle storiche di YITH o Smush.

### 8.2 Inquinamento dei Dati (Il problema qTranslate-X)
Il modo in cui `qtranslate-x` salva i dati altera permanentemente la struttura standard. I contenuti nella tabella `wpapinst_posts` (colonne `post_title`, `post_content`, `post_excerpt`) e in `wpapinst_postmeta` non sono salvati come post separati (come fa WPML), ma in blocchi unici fusi da shortcode:
- Esempio di dato nel DB: `[:it]Descrizione in italiano[:en]Description in english[:]`
- **Impatto sul nuovo sito**: Prima di qualsiasi importazione verso un nuovo template o CMS, sarà obbligatorio scrivere uno script (in PHP, Python o tramite query SQL avanzate) che faccia il "parsing" e la suddivisione (split) di questi campi per separare le lingue in entità distinte.

### 8.3 Lock-in del Page Builder (Elementor / WPBakery)
- Il contenuto visuale delle pagine non risiede in semplice HTML in `wpapinst_posts`, ma è strutturato come JSON complesso all'interno di `wpapinst_postmeta` (specifico per Elementor) o tramite shortcode sparsi (specifici per WPBakery). 
- **Impatto sul nuovo sito**: Se il nuovo sito manterrà Elementor, i dati saranno recuperabili. Se si passerà a Gutenberg (o a un CMS totalmente diverso come Shopify/Prestashop), il design dovrà essere ricostruito da zero copiando solo il testo grezzo e i media.

### 8.4 Dati E-Commerce (Intoccabili)
- Le tabelle `wpapinst_wc_orders`, `wpapinst_woocommerce_order_items`, `wpapinst_wc_customer_lookup` sono il cuore finanziario del sito. Qualsiasi migrazione deve prevedere l'estrazione e il re-inserimento perfetto di queste relazioni relazionali senza perdita di ID, altrimenti si perderà lo storico ordini dei clienti.

## 9. Raccomandazioni per il Refactoring e lo Sviluppo AI
1. **Migrazione Multilingua**: La priorità assoluta per un upgrade è lo sgancio da `qtranslate-x`. Il database dovrà essere parsato tramite regex per separare i campi lingua in tabelle separate (es. Polylang o WPML).
2. **Revisione della Logica SEO**: Il plugin `ap-customization` reinventa la ruota per Yoast SEO al fine di farla coesistere con qTranslate. Passando a un sistema multilingua moderno, l'intero plugin `ap-customization` potrebbe diventare obsoleto, permettendo l'uso nativo delle funzionalità SEO di WPML/Polylang con Yoast.
3. **Consolidamento Page Builder**: Se `js_composer` (WPBakery) non è strettamente necessario, andrebbe dismesso a favore di un uso esclusivo di Elementor per ripulire il DOM e migliorare le performance. I widget custom in `ap-elementor-widgets` dovranno essere testati e possibilmente aggiornati in conformità con le ultime API di Elementor.
4. **Pulizia Pre-Migrazione**: Effettuare una query SQL di esportazione che escluda intenzionalmente tutte le tabelle `wpapinst_wf%` (Wordfence) e svuoti le tabelle di log di WooCommerce per alleggerire il carico sul nuovo database.
