# Gwent Classic Online

Gwint z Wiedźmina 3 w przeglądarce — gra z botem (offline) i, w kolejnym etapie, gra online.

```
gwent-classic-online/
├── frontend/   Vue 3 + TypeScript + Vite  (gotowe: tryb offline 1:1 z oryginałem)
└── backend/    Java / Spring Boot          (etap 2: tryb online)
```

## Uruchomienie (frontend)

Wymagany Node.js 20+.

```bash
cd frontend
npm install
npm run dev        # http://localhost:47317
npm run build      # produkcyjny build do frontend/dist
npm run typecheck  # sprawdzenie typów (vue-tsc), opcjonalnie
```

Ekran startowy: **Play vs AI** (offline) albo **Play Online** (na razie zapowiedź).
Dodaj `?debug` do adresu (`/offline?debug`), żeby w konsoli mieć `window.__gwent` (stan gry, silnik) — przydatne przy testach.

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
├── engine/          czysta logika gry (bez DOM) — port gwent.js / abilities.js / factions.js
│   ├── card.ts, containers.ts (Deck, Hand, Grave, Row, Weather), board.ts, player.ts
│   ├── abilities.ts, factions.ts, ai.ts (ControllerAI), game.ts (przebieg gry)
│   ├── context.ts   interfejs UIPort — jedyny kontakt silnika z warstwą prezentacji
│   └── data/        cards.ts (card_dict), decks.ts (talie AI)
├── ui/              warstwa prezentacji
│   ├── store.ts     stan UI (podgląd, karuzela, popup, podświetlanie rzędów) — port klas UI/Carousel/Popup
│   ├── flight.ts    animacja lotu kart między rzędami (odpowiednik translateTo)
│   ├── deckMaker.ts kreator talii, audio.ts, settings.ts (localStorage)
│   └── components/  CardView, FieldRow, PlayerStats, LeaderBox, CardPile, CarouselView, PopupView, EndScreen, DeckCustomization…
└── views/           HomeView (wybór trybu), OfflineGame (plansza), OnlineView (zapowiedź)
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

## Etap 2: tryb online (plan)

Proponowany kształt, do doprecyzowania przy backendzie:

**Backend — Java 21 + Spring Boot 3**

- **Konta:** logowanie Google (Spring Security OAuth2 / OIDC) albo gość z samym pseudonimem; sesja jako JWT/cookie.
- **Dane:** PostgreSQL + JPA + Flyway — użytkownicy, talie (ten sam format JSON co teraz), historia meczów (talie, wynik, rundy).
- **Lobby:**
  - *Szybka gra* — kolejka matchmakingu, łączy dwóch czekających graczy,
  - *Zaproszenie linkiem* — `/join/{kod}`, jednorazowy kod pokoju, ważny np. 15 min,
  - *Wyzwanie po pseudonimie* — powiadomienie do zalogowanego gracza, akceptuj/odrzuć.
- **Gra:** serwer jest autorytatywny — reguły (port `src/engine` do Javy) liczą się na serwerze, klient wysyła tylko intencje
  (`PLAY_CARD {cardId, row}`, `PASS`, `LEADER`, `CHOOSE {cardIds}`, `CHOOSE_ROW {row}`), a serwer rozsyła zdarzenia i stan.
  Dzięki temu nie da się oszukiwać edytując klienta, a ręka przeciwnika nigdy nie trafia do przeglądarki.
- **Transport:** WebSocket (STOMP), reconnect do trwającego meczu, limit czasu na turę.

**Frontend** — nowy widok lobby + logowanie; plansza zostaje ta sama, a zamiast lokalnego AI ruchy przeciwnika
przychodzą z serwera (nowa implementacja `UIPort`/kontrolera gracza zdalnego). Vite ma już proxy `/api` i `/ws` na `localhost:8080`.
