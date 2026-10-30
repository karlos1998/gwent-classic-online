# Gwent Classic Online

Gwint z Wiedźmina 3 w przeglądarce — gra z botem (offline) i gra online z prawdziwym przeciwnikiem.

```
gwent-classic-online/
├── frontend/           Vue 3 + TypeScript + Vite (tryb offline 1:1 z oryginałem + klient trybu online)
├── backend/            Java 21 + Spring Boot 3.5 + Gradle (serwer trybu online, bez bazy danych)
├── docker-compose.yml  cały stos jednym poleceniem
└── .env.example        konfiguracja (czas ruchu, limity, origin, przyszłe logowanie Google)
```

## Szybki start (Docker)

```bash
cp .env.example .env          # opcjonalnie
docker compose up --build     # http://localhost:47320
```

Kontener `web` (nginx) serwuje frontend i przekazuje `/api` oraz `/ws` do kontenera `server` (Spring Boot, port 47321,
niewystawiony na zewnątrz). Żeby zagrać samemu ze sobą, otwórz grę w dwóch różnych przeglądarkach albo w oknie prywatnym
(sesja gościa jest per karta).

## Produkcja

Adres: https://gwent.letscode.it. Push do `main` uruchamia `.github/workflows/deploy-production.yml`:
sprawdzenie typów i backendu, budowę dwóch obrazów Docker, przesłanie przez SSH i start z kontrolą zdrowia.
Repozytorium wymaga sekretów `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY` i `SERVER_KNOWN_HOSTS`
(zweryfikowany klucz hosta SSH). Forki nie uruchamiają deploymentu na ten serwer.

Na serwerze aplikacja jest w `/opt/apps/gwent-classic-online`, korzysta z zewnętrznej sieci
`nginx-proxy` i automatycznego certyfikatu Let's Encrypt. Backend pozostaje w prywatnej sieci;
nie trzeba konfigurować bazy ani tokenów aplikacji. DNS `gwent.letscode.it` musi wskazywać serwer.

`TAG` przechowuje wdrożony commit. Przy błędzie kontroli zdrowia skrypt przywraca poprzednie obrazy.
Ręczny rollback: w katalogu aplikacji ustaw `TAG=<poprzedni commit>` i uruchom
`docker compose -f docker-compose.production.yml up -d --wait`. Stan gier jest w pamięci,
więc restart backendu przerywa aktywne mecze i sesje.

## Uruchomienie bez Dockera

Backend (JDK 21; Gradle pobierze się sam przez wrapper):

```bash
cd backend
./gradlew bootRun     # http://localhost:47321, dokumentacja API: /swagger-ui.html, zdrowie: /actuator/health
./gradlew test
```

Frontend (Node.js 20+), dev server ma proxy `/api` i `/ws` na `localhost:47321`:

```bash
cd frontend
npm install
npm run dev        # http://localhost:47317
npm run build      # produkcyjny build do frontend/dist
npm run typecheck  # sprawdzenie typów (vue-tsc), opcjonalnie
```

Ekran startowy: **Graj z komputerem** (offline) albo **Graj online**.
Dodaj `?debug` do adresu (`/offline?debug`, `/online?debug`), żeby w konsoli mieć `window.__gwent` (stan gry, silnik)
i `window.__gwentOnline` (sesja online) — przydatne przy testach.

## Języki (i18n)

Aplikacja jest w pełni dwujęzyczna (EN / PL) dzięki [vue-i18n](https://vue-i18n.intlify.dev/). Przełącznik z flagami jest
w prawym górnym rogu na każdym ekranie. Domyślnie używany jest język przeglądarki (polski → PL, każdy inny → EN),
a wybór zapamiętuje się w localStorage.

- Wszystkie teksty są w `src/i18n/locales/en.ts` i `pl.ts`, nic nie jest wpisane na sztywno (szablony, alerty, popupy,
  powiadomienia, które w oryginale siedziały w CSS, nazwy kart, opisy zdolności i frakcji).
- `pl.ts` jest typowany strukturą `en.ts`, więc brakujący albo nadmiarowy klucz to błąd TypeScriptu (`npm run typecheck`).
- Silnik gry dalej używa angielskich nazw kart jako identyfikatorów (zależą od nich zasady „muster” i „więź”).
  Wyświetlana nazwa pochodzi z klucza `cards.<nazwa_w_snake_case>`, np. `cards.geralt_of_rivia`.
- Napisy wydrukowane na samych grafikach (nazwy i cytaty na kartach, „Victory/Defeat” na ekranie końcowym) są częścią
  obrazków z gry i zostają po angielsku.
- Dodanie języka: skopiuj `pl.ts` jako np. `de.ts`, przetłumacz, dopisz do `LOCALES` i `messages` w `src/i18n/index.ts`
  i dodaj flagę `public/svg/flag_de.svg`.

## Skąd to jest

Tryb offline to port 1:1 projektu [Gwent Classic](https://github.com/asundr/gwent-classic) autorstwa Aruna Sundarama
(to, co działa na arunsundaram.com/gwent-classic-app). Przeniesione zostały:

- wszystkie grafiki (`public/img`), dźwięki (`public/sfx`) i ikony (`public/svg`) bez zmian,
- dane wszystkich 216 kart (baza + Serca z Kamienia + Krew i Wino + Skellige) w tej samej kolejności indeksów,
  więc pliki talii `.json` z oryginału działają bez zmian (Upload / Download Deck),
- wszystkie zdolności kart i liderów, perki frakcji, AI przeciwnika, gotowe talie AI,
- cały wygląd: struktura DOM i oryginalny arkusz stylów (`src/assets/gwent.css`) — zmieniono tylko ścieżki do grafik,
- muzyka (ten sam utwór z YouTube), efekty dźwiękowe, ustawienia w localStorage, karuzele, popupy, powiadomienia.

Weryfikacja: z tym samym ziarnem losowości oryginał i ta wersja dają identyczny stan gry (te same talie, ręce i ruchy AI).
Zrzuty ekranu kreatora talii i karuzel są identyczne co do piksela; na planszy jedyna różnica to licznik pustego rzędu
oblężniczego przeciwnika — oryginał pokazuje tam zaszyte w HTML „12”, dopóki nie trafi tam karta, tu jest poprawne 0.
Silnik przeszedł ~1000 automatycznych partii bot vs bot, a UI pełne partie klikane przez bota w przeglądarce.

**Licencja:** oryginał jest na MIT + „Commons Clause” — wolno używać i modyfikować, **nie wolno sprzedawać**
(ani usług, których wartość wynika głównie z tego oprogramowania). Gwint i Wiedźmin to znaki towarowe CD PROJEKT S.A.,
grafiki pochodzą z gry. Traktuj to jako projekt fanowski, niekomercyjny.

## Architektura frontendu

```
src/
├── i18n/            tłumaczenia EN/PL (vue-i18n)
├── engine/          czysta logika gry (bez DOM, bez tekstów dla użytkownika) — port gwent.js / abilities.js / factions.js
│   ├── card.ts, containers.ts (Deck, Hand, Grave, Row, Weather), board.ts, player.ts
│   ├── abilities.ts, factions.ts, ai.ts (ControllerAI), game.ts (przebieg gry)
│   ├── context.ts   interfejs UIPort — jedyny kontakt silnika z warstwą prezentacji
│   └── data/        cards.ts (card_dict), decks.ts (talie AI)
├── ui/              warstwa prezentacji
│   ├── store.ts     stan UI (podgląd, karuzela, popup, podświetlanie rzędów) — port klas UI/Carousel/Popup
│   ├── flight.ts    animacja lotu kart między rzędami (odpowiednik translateTo)
│   ├── deckMaker.ts kreator talii, audio.ts, settings.ts (localStorage)
│   └── components/  CardView, FieldRow, PlayerStats, LeaderBox, CardPile, CarouselView, PopupView, EndScreen, DeckCustomization…
├── online/          klient trybu online
│   ├── protocol.ts  typy wiadomości (lustro rekordów z backendu)
│   ├── api.ts, socket.ts   REST (sesja gościa) i WebSocket (auth, ping, automatyczny reconnect)
│   ├── session.ts   maszyna stanów: pseudonim → lobby (szukanie / mecz znaleziony) → gra
│   ├── mirror.ts    przenosi migawki serwera na obiekty planszy i animuje różnice (loty kart)
│   ├── game.ts      kolejka wiadomości gry, prompty (tura, wymiana kart, wybór karty/rzędu), efekty, timer
│   └── components/  NicknameForm, LobbyBar, SearchPanel, MatchFoundDialog, PlayerCard, TurnTimer, OpponentAway, ToastStack
└── views/           HomeView (wybór trybu), OfflineGame, OnlineView — obie gry używają tej samej planszy (GameBoard)
```

Obiekty silnika są reaktywne (Vue `reactive`), więc komponenty po prostu renderują ich stan. Silnik nie wie nic o Vue
poza tym — rozmawia z UI tylko przez `UIPort` (powiadomienia, wybór kart, wybór rzędu, animacje). To jest punkt
zaczepienia pod tryb online.

### Świadome poprawki względem oryginału

Wszystko inne zachowuje się dokładnie jak w oryginale (łącznie z jego drobnymi dziwactwami). Poprawione zostały tylko błędy,
które zawieszały grę albo psuły stan:

1. AI zawieszało turę, gdy suma wag ruchów była ujemna (np. Francesca „Nadzieja Aen Seidhe” bez kart zwinnych,
   Eredin „Król Dzikiego Gonu” bez pogody w talii) — teraz w takim przypadku pasuje.
2. Wyjście z gry w trakcie tury przeciwnika zostawiało działające „w tle” animacje i ruchy — teraz są przerywane.
3. Po wyjściu z gry w trakcie pogody zostawała nakładka pogody na następną grę.
4. Karta z „Avenger” (Krowa, Kambi) mogła przywołać jednostkę do następnej gry przy resecie planszy.
5. Import talii z ostrzeżeniami zawsze kończył się błędem „not formatted correctly” (literówka w zmiennej + odwrócony `confirm`);
   teraz pyta, czy mimo to wczytać. Wczytana talia jest też od razu zapamiętywana.
6. Dźwięk zablokowany przez przeglądarkę mógł zatrzymać grę (obietnica nigdy się nie kończyła).

## Tryb online

**Przebieg:** *Graj online* → unikalny pseudonim (walidacja na żywo, ta sama reguła co na serwerze: 3–20 liter/cyfr,
pojedyncze spacje lub `_ . -` tylko w środku, bez nazw zarezerwowanych, unikalność bez rozróżniania wielkości liter)
→ lobby z kreatorem talii → *Szukaj przeciwnika* (licznik czasu, można anulować) → gdy ktoś szuka w tym samym czasie,
obaj widzą okno „Gotów na pojedynek?” z pseudonimem, domyślnym awatarem i plakietką **Gość** (widok jest przygotowany
pod konta: awatar, stała nazwa, liczba rozegranych gier) → obaj akceptują = start gry. Odrzucenie przez jednego wraca
obu do szukania (ta para nie zostanie dobrana ponownie przez 2 min); brak odpowiedzi w 20 s anuluje propozycję.

**W grze:** ta sama plansza co offline. Na górze pasek czasu ruchu (domyślnie 60 s, `gwent.game.turn-timeout`), który
kurczy się od końca do początku i zmienia kolor złoty → bursztynowy → czerwony (ostatnie 10 s pulsuje); w turze
przeciwnika jest przygaszony. Po upływie czasu serwer wykonuje domyślny, legalny ruch (tura → pas, wybór karty → losowa,
wybór rzędu → walka wręcz). Przycisk wyjścia = poddanie się. Zerwane połączenie: klient sam się łączy ponownie
(odświeżenie strony też wraca do gry), przeciwnik widzi odliczanie, a po 45 s (`reconnect-grace`) jest walkower.

### Backend

Java 21, Spring Boot 3.5, Gradle (Kotlin DSL), Lombok, Bean Validation, Caffeine, Actuator + Micrometer,
springdoc-openapi. Bez bazy danych — wszystko żyje w pamięci przez czas sesji.

```
com.gwentonline
├── game/engine      silnik gry niezależny od Springa (port src/engine 1:1, zweryfikowany ~99 000 partii bot vs bot)
├── game/room        GameRoom (jedna gra = jeden wirtualny wątek + kolejka wejść), SnapshotFactory, EventTranslator
├── matchmaking      kolejka, propozycja meczu, akceptacja / odrzucenie / timeout, cooldown pary
├── player           sesje gości, NicknamePolicy + @ValidNickname, REST /api/v1/sessions
├── transport        WebSocket: uwierzytelnienie, limity, parsowanie, dispatch
├── protocol         rekordy wiadomości (sealed interfaces, jawna lista typów)
├── config, common   właściwości gwent.* (walidowane), CORS, rate limiting, ProblemDetail z kodem błędu
```

Komunikacja: `POST /api/v1/sessions {nickname}` zwraca token sesji gościa, cała reszta idzie przez WebSocket `/ws`
(pierwsza wiadomość `auth`). Klient wysyła tylko intencje (`playCard`, `pass`, `activateLeader`, `chooseCard`, …) z id
promptu; serwer liczy całą grę i wysyła każdemu graczowi **jego własną** migawkę stanu, efekty (powiadomienia, dźwięki,
animacje) i prompty z terminem. Kody błędów (`errors.<kod>`) są tłumaczone po stronie klienta.

### Bezpieczeństwo

- **Serwer jest autorytatywny.** Klient niczego nie liczy; każdy ruch jest walidowany (karta w ręce, legalny rząd,
  cel wabika, dostępność dowódcy, aktualny prompt). Nieprawidłowe ruchy są odrzucane, zegar tury dalej biegnie.
- **Brak wycieku ukrytych informacji.** Migawka jest budowana osobno dla każdego gracza (`SnapshotFactory`): ręka
  przeciwnika i obie talie to wyłącznie liczby, karty mają losowe, nieprzewidywalne id na grę. Animacje ukrytych kart
  są odfiltrowywane. Jedyny wyjątek to zdolność Emhyra „Imperator Nilfgaardu” — dostaje się wtedy dokładnie 3 losowe
  karty z ręki przeciwnika, tylko ten gracz i tylko te karty (zgodnie z zasadami gry).
- **Sesje:** token 256-bit z `SecureRandom`, trzymany w `sessionStorage` (nie w cookies, więc bez CSRF); druga karta
  z tym samym tokenem przejmuje sesję (stara dostaje kod 4001). Nieaktywne sesje wygasają po 3 min.
- **Limity:** rozmiar wiadomości WS (16 KB), token bucket na połączenie (zalewanie → zamknięcie 4029), 10 nowych sesji
  na minutę z jednego IP, czas na `auth` (10 s), limit sesji (5000) i równoległych gier (1000), bufor wysyłki
  z limitem czasu (wolny klient nie blokuje gry), dozwolone originy dla WebSocketu i CORS.
- **Parsowanie:** osobny, ścisły `ObjectMapper` (nieznane pola = błąd, bez default typing, jawna lista podtypów),
  każdy rekord sam waliduje swoje pola.
- **Współbieżność:** każda gra działa na własnym wirtualnym wątku i jest jedynym właścicielem swojego stanu, więc
  dziesiątki czy setki równoczesnych gier nie dzielą żadnych blokad; matchmaking ma jedną blokadę, a wiadomości są
  wysyłane dopiero po jej zwolnieniu. Test obciążeniowy: 100 równoległych par botów po WebSocketach — wszystkie
  partie zakończone, zero błędów protokołu, zero wycieków ręki przeciwnika.
- Kontener backendu działa jako nie-root, z systemem plików tylko do odczytu; nginx dodaje nagłówki bezpieczeństwa.

### Konfiguracja

Wszystkie wartości są w `backend/src/main/resources/application.yml` (`gwent.*`) i każdą można nadpisać zmienną
środowiskową, np. `GWENT_GAME_TURN_TIMEOUT=90s` — patrz `.env.example`.

### Dalej

- Konta i logowanie Google — opcjonalne, włączane przez administratora w `.env` (`GWENT_AUTH_GOOGLE_ENABLED`), domyślnie
  wyłączone, więc nikt stawiający własny serwer nie musi niczego konfigurować. Protokół i widoki mają już miejsce na
  `ACCOUNT` (awatar, liczba gier).
- Zaproszenie znajomego linkiem i wyzwanie po pseudonimie.
