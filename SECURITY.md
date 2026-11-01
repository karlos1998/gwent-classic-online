# Bezpieczeństwo trybu online

Tryb offline nie łączy się z backendem ani nie ładuje Turnstile. Tryb online wymaga weryfikacji
przed utworzeniem nowej sesji gościa. Powrót do istniejącej sesji nie wymaga kolejnej captchy.
Turnstile ogranicza automatyczne zakładanie sesji; nie zastępuje walidacji ruchów, limitów ani ochrony originu.

## Wdrożone zabezpieczenia

- Formularz wysyła token Turnstile do Javy. Java wywołuje wyłącznie oficjalny endpoint Siteverify przez HTTPS.
  W produkcji sprawdza `success`, dokładny hostname i `action=online-entry`. Nie ufa wynikowi z przeglądarki.
  Cloudflare weryfikuje jednorazowość i ważność tokenu (5 minut).
- Brak tokenu, odrzucenie, błędna odpowiedź lub awaria Cloudflare nie tworzą sesji ani nie rezerwują nicku.
  Po każdej próbie formularz odświeża token. Błąd ładowania ma przycisk ponowienia.
- Siteverify: do 16 równoczesnych wywołań, timeout połączenia 3 s i odpowiedzi 5 s.
  Sekret pozostaje w backendzie; publiczny `/api/v1/sessions/challenge` zwraca tylko site key.
- Oficjalne klucze testowe są domyślne wyłącznie dla lokalnej konfiguracji. Tryb testowy odrzuca publiczne
  originy przy starcie. Produkcja wymusza `test-mode=false` i odrzuca testowe klucze.
- Limity typu token bucket z początkowym budżetem i płynnym uzupełnianiem: wszystkie `/api/` 120/min/IP,
  próby tworzenia sesji 10/min/IP (również błędny JSON / nick), upgrade `/ws` 30/min/IP.
  Komunikaty WS: dotychczasowy limit 30 / 10 na sekundę na połączenie i wspólny budżet 2400/min/IP,
  zachowany przy reconnect. To limity na pojedynczą instancję aplikacji.
- Do 2000 otwartych WebSocketów i 12 na IP, także bez autoryzacji. Przekroczenie zamyka nowe połączenie.
  Anonimowe połączenia mają 10 s na autoryzację. Powtarzające się błędy protokołu zamykają połączenie.
- Limit wejścia REST 16 KiB w nginx i Javie (także bez Content-Length), dotychczasowe ograniczenia WS,
  kolejka gry 256, limity sesji i gier, limity buforów i czasu wysyłania. Rezerwacja limitu sesji jest atomowa.
- JSON WS odrzuca literalne `null`, nieznane typy/pola, dane po wiadomości i niewłaściwe pola rekordów.
  Nie ma deserializacji dowolnych klas. Serwer waliduje talię, uprawnienia gracza, turę i ruchy.
- Odpowiedzi API mają `Cache-Control: no-store`, również te zawierające token sesji.
  Dokumentacja API jest domyślnie wyłączona, publiczny nginx blokuje dokumentację i actuator.
  Wewnątrz sieci kontenerów dostępny jest healthcheck, metryki nie są publicznie eksponowane.
- Nginx ogranicza czas nagłówków/body i wysyłki, dodaje CSP, zakaz osadzania strony,
  `nosniff`, politykę referrera i wyłącza kamerę/mikrofon/geolokalizację.
  CSP dopuszcza Turnstile i istniejący odtwarzacz YouTube, style inline są potrzebne animacjom.
- Backend: Spring Boot 4.1.2 / Jackson 3; aktualizacja narzędzi typowania frontendu usuwa zgłoszenia npm audit.
  Dependabot proponuje cotygodniowe aktualizacje zależności i obrazów, bez automatycznego merge/deploy.

## Localhost

Domyślne oficjalne klucze Cloudflare „always pass”:

```dotenv
GWENT_TURNSTILE_TEST_MODE=true
GWENT_TURNSTILE_SITE_KEY=1x00000000000000000000AA
GWENT_TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
GWENT_TURNSTILE_HOSTNAMES=localhost,127.0.0.1
```

Nie ma lokalnego obejścia weryfikacji: przeglądarka i Java nadal łączą się z Cloudflare, więc
online lokalnie wymaga internetu. Offline działa bez captchy. Dla uruchomienia bez Dockera
`application.yml` zawiera te same wartości; Spring Boot sam nie wczytuje pliku `.env`.

## Produkcja — konfiguracja wykonana 1 listopada 2026

Na koncie Cloudflare właściciela utworzono widget **Gwent Classic Online** w trybie Managed,
z jednym dozwolonym hostname `gwent.letscode.it`, bez pre-clearance. Nie dopuszcza localhost.
Prawdziwe klucze są w `/opt/apps/gwent-classic-online/.env` na serwerze, z uprawnieniami `600`.
Sekret nie jest zapisany w repozytorium ani w zmiennych Vite. Produkcyjny sekret sprawdzono bezpiecznie
przez Siteverify: oficjalny dummy token jest odrzucany jako `invalid-input-response`, bez błędu sekretu.

Skonfigurowano na żywo:

- **Gwent — Full strict origin TLS**: Configuration Rule, dokładnie `http.host eq "gwent.letscode.it"`, SSL Strict.
  Globalny tryb pozostałych hostów nie został zmieniony.
- **Gwent — require HTTPS**: HTTP → HTTPS wyłącznie dla Gwinta, status 308, zachowana ścieżka i query string.
- **Gwent — session and WS flood protection**: 20 żądań / 10 s / IP, blokada przez 10 s.
  Obejmuje tylko host Gwinta i `POST /api/v1/sessions` lub `GET /ws`, bez HTML challenge na API/WS.
  Zajmuje jedną regułę rate limiting dostępną w aktualnym darmowym planie strefy.
- Origin używa istniejącego ważnego certyfikatu Let's Encrypt (odnowienia przez acme-companion).
  Compose ma `LETSENCRYPT_HOST=gwent.letscode.it` i `HTTPS_METHOD=noredirect`, więc origin obsługuje TLS
  bez przekierowań HTTP → HTTPS, które wcześniej powodowały pętlę w trybie Flexible.
- Vhost originu dopuszcza tylko oficjalne zakresy IPv4/IPv6 Cloudflare i loopback.
  Bezpośrednie wejście przez IP z Host/SNI Gwinta zwraca 403, także ze sfałszowanymi nagłówkami.
  Ścieżka `/.well-known/acme-challenge/` pozostaje dostępna do odnowienia certyfikatu.
  Jest to blokada vhostu, a nie zmiana firewalla całego współdzielonego serwera.
- Proxy odrzuca dostarczony X-Forwarded-For i buduje go z CF-Connecting-IP dopiero po kontroli źródła.
  Przekazuje nagłówki WebSocket i normalizuje Host, proto i port. Java nie ufa dowolnemu nagłówkowi klienta.
  Wcześniejsze ogólnokontowe reguły IP Allow właściciela pozostają poza zakresem zmiany.

Sprawdzono działanie publicznego HTTPS/API, logowanie przez WSS i ping/pong, przekierowanie 308 z query,
limit sesji po 10 próbach, odrzucenie spreparowanych nagłówków i blokadę originu.
Rozdzielenie budżetów dwóch IP zweryfikowano przez zaufany loopback originu: IP A dostaje 429 po 10 próbach,
a IP B nadal może utworzyć sesję. Publiczny test z datacenter został odrzucony przez Cloudflare (403),
więc nie traktujemy go jako potwierdzenia obsługi drugiego publicznego klienta. Testowe sesje usunięto.

Kod aplikacji jest wdrażany przez push do `main` i GitHub Actions. Nowe obrazy włączają captchę
w publicznym formularzu i jej egzekwowanie w produkcyjnej Javie. Klucze są pobierane z `.env` na serwerze.
Po wdrożeniu należy sprawdzić odrzucenie brakującego i niepoprawnego tokenu oraz wejście do lobby
z prawdziwym widgetem. Restart backendu kończy stan istniejących sesji i gier.

### Utrzymanie originu

Konfiguracja vhostu jest poza kontenerem, w `/opt/apps/nginx-proxy/vhost/`:
`gwent.letscode.it` i `gwent.letscode.it_location`. Przetrwa restarty proxy i deploymenty aplikacji.
Skrypt `deploy/configure-origin-proxy.py` pobiera aktualne zakresy z publicznego API Cloudflare,
waliduje je, zachowuje kopie poprzednich plików, regeneruje konfigurację i wykonuje `nginx -t` przed reload.
Przy błędzie walidacji przywraca poprzednie pliki. Odmawia nadpisania obcej ręcznej konfiguracji.
Nginx ma mount tylko do odczytu; zapis wykorzystuje krótkotrwały kontener z tego samego lokalnego obrazu,
bez sieci, socketu Docker, dodatkowych capabilities ani dostępu do innych katalogów.

Przy zmianie zakresów Cloudflare albo odbudowie serwera uruchomić z checkoutu:

```bash
ssh -i ~/.ssh/github_actions_deploy deploy@46.105.131.250 python3 < deploy/configure-origin-proxy.py
```

Sprawdzać odnawianie certyfikatu i ponawiać test publicznego HTTPS/WSS po zmianach wspólnego proxy.
Usunięcie lub zmiana reguły Full (strict) wymaga ponownej oceny szyfrowania. Nie wyłączać walidacji TLS.
Nie dodawać `/api/*` ani `/ws` do reguł Cache Everything. Przed publicznym otwarciem po deploymentcie
powtórzyć test captcha → lobby → mecz → reconnect, odrzucenia/replay tokenu i obciążenia.
Istniejące maksima 5000 sesji/1000 gier nie są gwarancją pojemności kontenera 768 MiB.

Żadna captcha nie gwarantuje braku botów ani ochrony przed rozproszonym DoS. Przy wielu instancjach
limity i sesje wymagają wspólnego magazynu; obecna architektura zakłada jeden backend i stan w pamięci.

## Weryfikacja zmian

```bash
cd backend && ./gradlew test bootJar
cd ../frontend && npm ci && npm run typecheck && npm run build && npm audit
```

23 testy sprawdzają odrzucenie captchy, hostname/action, brak tworzenia sesji po błędzie,
tryb testowy/produkcyjny, niedostępność Siteverify, limity błędnych prób i upgrade, wielkość body,
limity otwartych WS i równoczesnych rezerwacji sesji, ścisły protokół, start aplikacji z katalogiem kart i zamknięte endpointy diagnostyczne.
Testy odpowiedzi Siteverify korzystają z kontrolowanego serwera testowego Springa; nie zależą od sieci Cloudflare.

## Dokumentacja źródłowa

- [Turnstile — klucze testowe](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
- [Turnstile — walidacja serwerowa](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Cloudflare — WAF i WebSocket](https://developers.cloudflare.com/network/websockets/)
- [Cloudflare — ograniczenia Flexible](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/flexible/)
- [Spring Boot 3.5 — koniec wsparcia OSS](https://spring.io/blog/2026/06/25/spring-boot-3-5-16-available-now/)
