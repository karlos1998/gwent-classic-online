// Deck customization screen logic - port of the original DeckMaker class
import { reactive } from 'vue'
import {
  Card,
  CardContainer,
  card_dict,
  constructOpponentDeck,
  ctx,
  factions,
  isEmpty,
  Player,
  type CardData,
  type DeckData,
  type IdCount,
} from '@/engine'
import { AudioManager } from './audio'
import { Settings } from './settings'
import { ui } from './store'
import { cardName, factionDescription, factionName, t } from '@/i18n'

export interface BankEntry {
  index: number
  count: number
}

interface LeaderEntry {
  index: number
  card: CardData
}

const FACTIONS = ['realms', 'nilfgaard', 'monsters', 'scoiatael', 'skellige'] as const

export class DeckMaker {
  faction = ''
  leaders: LeaderEntry[] = []
  leader: LeaderEntry | null = null
  bank: BankEntry[] = []
  deck: BankEntry[] = []
  stats = { total: 0, units: 0, special: 0, strength: 0, hero: 0 }
  opponentData: { faction: string; leader: number; cards: IdCount[] } | Record<string, never> = {}

  constructor() {
    const self = reactive(this) as DeckMaker
    self.loadFactionDeck(Settings.lastFaction.get(), true)
    self.opponentData = Settings.opponentDeckCustom.get() as DeckMaker['opponentData']
    return self
  }

  get factionName() {
    return this.faction ? factionName(this.faction) : ''
  }

  get factionDescription() {
    return this.faction ? factionDescription(this.faction) : ''
  }

  get hasCustomOpponent() {
    return !isEmpty(this.opponentData)
  }

  get customOpponentLeaderName() {
    return this.hasCustomOpponent ? cardName(card_dict[(this.opponentData as { leader: number }).leader].name) : t('deck.random')
  }

  loadFactionDeck(faction: string, _force = false) {
    if (!this.isValidFaction(faction)) return
    if (!this.setFaction(faction, true)) return
    const faction_deck = Settings.getFactionSettings(this.faction)!.get()
    this.setLeader(faction_deck.leader!)
    this.makeBank(this.faction, faction_deck.cards)
    this.update()
  }

  isValidFaction(factionName: string) {
    return (FACTIONS as readonly string[]).includes(factionName)
  }

  // Called when client selects a deck faction. Clears previous cards and makes valid cards available.
  setFaction(faction_name: string, force?: boolean) {
    if (!faction_name) return
    if (!force && this.faction === faction_name) return false
    this.leaders = card_dict
      .map((c, i) => ({ index: i, card: c }))
      .filter((c) => c.card.deck === faction_name && c.card.row === 'leader')
    if (!this.leader || this.faction !== faction_name) this.leader = this.leaders[0]
    this.faction = faction_name
    Settings.lastFaction.set(faction_name)
    return true
  }

  // Sets current leader
  setLeader(index: number) {
    this.leader = this.leaders.filter((l) => l.index == index)[0] ?? this.leaders[0]
  }

  // Constructs a bank of cards that can be used by the faction's deck.
  // If a deck is provided, will not add cards to bank that are already in the deck.
  makeBank(faction: string, deck?: IdCount[]) {
    this.clear()
    const cards = card_dict
      .map((c, i) => ({ card: c, index: i }))
      .filter((p) => [faction, 'neutral', 'weather', 'special'].includes(p.card.deck) && p.card.row !== 'leader')

    cards.sort(function (id1, id2) {
      const a = card_dict[id1.index],
        b = card_dict[id2.index]
      const c1 = { name: a.name, basePower: -Number(a.strength), faction: a.deck }
      const c2 = { name: b.name, basePower: -Number(b.strength), faction: b.deck }
      return Card.compare(c1, c2)
    })

    const deckMap: Record<number, number> = {}
    if (deck) for (const d of deck) deckMap[d.index] = d.count
    const bank: BankEntry[] = []
    const deckEntries: BankEntry[] = []
    cards.forEach((p) => {
      const count = deckMap[p.index] !== undefined ? Number(deckMap[p.index]) : 0
      bank.push({ index: p.index, count: Number.parseInt(p.card.count) - count })
      deckEntries.push({ index: p.index, count })
    })
    this.bank = bank
    this.deck = deckEntries
  }

  // Updates the stats when any changes are made to the deck
  update() {
    let total = 0,
      units = 0,
      special = 0,
      strength = 0,
      hero = 0
    for (const x of this.deck) {
      const card_data = card_dict[x.index]
      total += x.count
      if (card_data.deck === 'special' || card_data.deck === 'weather') {
        special += x.count
        continue
      }
      units += x.count
      strength += Number(card_data.strength) * x.count
      if (card_data.ability.split(' ').includes('hero')) hero += x.count
    }
    this.stats = { total, units, special, strength, hero }
  }

  // Opens a Carousel to allow the client to select a leader for their deck
  selectLeader() {
    const container = new CardContainer()
    container.cards = this.leaders.map((c) => {
      const card = new Card(c.card, ctx.me ?? null)
      card.data = c
      return card
    })

    const index = this.leaders.findIndex((l) => l.index === this.leader?.index)
    ui.queueCarousel(
      container,
      1,
      (c, i) => {
        const data = c.cards[i].data as LeaderEntry
        this.leader = data
        Settings.getFactionSettings(this.leader.card.deck)!.setLeader(this.leader)
        AudioManager.playSFX('ui_card_bank')
      },
      () => true,
      false,
      true,
    )
    if (ui.carouselCurr) {
      ui.carouselCurr.index = index
      ui.carouselCurr.update()
    }
  }

  // Opens a Carousel to allow the client to select a faction for their deck
  selectFaction() {
    const container = new CardContainer()
    container.cards = Object.keys(factions).map((f) => {
      return {
        abilities: [f],
        filename: f,
        faction: 'faction',
      } as unknown as Card
    })
    const index = container.cards.reduce((a, c, i) => (c.filename === this.faction ? i : a), 0)
    ui.queueCarousel(
      container,
      1,
      (c, i) => {
        this.loadFactionDeck(c.cards[i].filename)
      },
      () => true,
      false,
      true,
    )
    if (ui.carouselCurr) {
      ui.carouselCurr.index = index
      ui.carouselCurr.update()
    }
  }

  // Called when client selects a preview card. Moves it from bank to deck or vice-versa then updates
  select(position: number, isBank: boolean) {
    if (isBank) {
      this.deck[position].count++
      this.bank[position].count--
      AudioManager.playSFX('ui_card_bank')
    } else {
      this.bank[position].count++
      this.deck[position].count--
      AudioManager.playSFX('discard')
    }
    Settings.getFactionSettings(this.faction)!.setCards(this.deck.filter((x) => x.count > 0))
    this.update()
  }

  // Removes all cards from bank and deck
  clear() {
    this.bank = []
    this.deck = []
    this.stats = { total: 0, units: 0, special: 0, strength: 0, hero: 0 }
  }

  /** Translated reasons why the deck cannot be played ('' = valid). The server checks the same rules. */
  validationWarning() {
    let warning = ''
    if (this.stats.units < 22) warning += t('alerts.minUnits') + ' \n'
    if (this.stats.special > 10) warning += t('alerts.maxSpecial') + ' \n'
    return warning
  }

  /** The current deck in the format of the online protocol */
  toDeckDto() {
    return {
      faction: this.faction,
      leader: this.leader!.index,
      cards: this.deck.filter((x) => x.count > 0).map((x) => ({ index: x.index, count: x.count })),
    }
  }

  // Verifies current deck, creates the players and their decks, then starts a new game
  startNewGame() {
    const warning = this.validationWarning()
    if (warning != '') {
      AudioManager.playSFX('warning')
      return alert(warning)
    }

    const me_deck: DeckData = {
      faction: this.faction,
      leader: card_dict[this.leader!.index],
      cards: this.deck.filter((x) => x.count > 0).map((x) => ({ index: x.index, count: x.count })),
    }
    const op_deck = this.constructOpponentDeck(true)

    // '' = the UI shows the translated default name (game.player1 / game.player2)
    ctx.me = new Player(0, '', me_deck)
    ctx.op = new Player(1, '', op_deck)
    ctx.game.newOpponentFactory = () => new Player('op', '', this.constructOpponentDeck(false))

    ui.customizationVisible = false
    ctx.game.startGame()
  }

  constructOpponentDeck(useCustom = true) {
    return constructOpponentDeck(this.opponentData as never, useCustom)
  }

  // Converts the current deck to a JSON string
  deckToJSON() {
    const obj = {
      faction: this.faction,
      leader: this.leader!.index,
      cards: this.deck.filter((x) => x.count > 0).map((x) => [x.index, x.count]),
    }
    return JSON.stringify(obj)
  }

  // Called by the client to download the current deck as a JSON file
  downloadDeck() {
    const json = this.deckToJSON()
    const a = document.createElement('a')
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(json)
    a.download = 'GwentDeck.json'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  uploadDeck(input: HTMLInputElement, callback: (deck: unknown) => void) {
    const files = input.files
    if (!files || files.length <= 0) return false
    const fr = new FileReader()
    fr.onload = (e) => {
      try {
        const deck = this.deckFromJSON(String(e.target!.result))
        if (deck) callback(deck)
      } catch {
        alert(t('alerts.notFormatted'))
      } finally {
        input.value = ''
      }
    }
    fr.readAsText(files.item(0)!)
  }

  // Called by the client to upload a JSON file representing a new deck
  uploadPlayerDeck(input: HTMLInputElement) {
    this.uploadDeck(input, (deck) => this.loadPlayerDeck(deck, false))
  }

  uploadOpponentDeck(input: HTMLInputElement) {
    this.uploadDeck(input, (deck) => this.loadOpponentDeck(deck, false))
  }

  deckFromJSON(json: string) {
    try {
      return JSON.parse(json)
    } catch {
      AudioManager.playSFX('warning')
      alert(t('alerts.notParsable'))
      return
    }
  }

  // Validates an uploaded deck. Returns null if rejected.
  // (fix) the original referenced an undefined `silent` variable and inverted confirm(), so any deck
  // with warnings failed with "not formatted correctly"; here the user can choose to import anyway.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loadDeck(deck: any, silent = true) {
    if (!deck) return null
    let warning = ''
    // verify that leader card is actually a leader and that its faction matches the deck faction
    if (card_dict[deck.leader].row !== 'leader')
      warning += t('alerts.notLeader', { name: cardName(card_dict[deck.leader].name) }) + '\n'
    if (deck.faction != card_dict[deck.leader].deck)
      warning +=
        t('alerts.leaderFaction', { name: cardName(card_dict[deck.leader].name), faction: deck.faction }) + '\n'
    // check if cards exist and have correct faction & count
    const cards: IdCount[] = (deck.cards as [number, number][])
      .filter((c) => {
        const card = card_dict[c[0]]
        if (!card) {
          warning += t('alerts.noCard', { id: c[0] }) + '\n'
          return false
        }
        if (![deck.faction, 'neutral', 'special', 'weather'].includes(card.deck)) {
          warning += t('alerts.wrongFaction', { name: cardName(card.name), faction: deck.faction }) + '\n'
          return false
        }
        if (Number(card.count) < c[1]) {
          warning += t('alerts.tooMany', { count: c[1], max: card.count, name: cardName(card.name) }) + '\n'
          c[1] = Number(card.count)
          return true
        }
        return true
      })
      .map((c) => ({ index: c[0], count: Math.min(c[1], Number(card_dict[c[0]].count)) }))
    // prompt warning if necessary
    if (warning) {
      if (silent) return null
      AudioManager.playSFX('warning')
      if (!confirm(warning + '\n\n' + t('alerts.continueImport'))) return null
    }
    return { faction: deck.faction as string, leader: deck.leader as number, cards: cards }
  }

  loadPlayerDeck(deck: unknown, silent = true) {
    const loadedDeck = this.loadDeck(deck, silent)
    if (!loadedDeck) return
    // Use deck to update current player faction and cards in deck maker
    this.setFaction(loadedDeck.faction, true)
    if (card_dict[loadedDeck.leader].row === 'leader' && loadedDeck.faction === card_dict[loadedDeck.leader].deck) {
      this.leader = this.leaders.filter((c) => c.index === loadedDeck.leader)[0]
    }
    this.makeBank(loadedDeck.faction, loadedDeck.cards)
    this.update()
    // (the original did not persist uploaded decks until the next card click; keep the deck)
    Settings.getFactionSettings(this.faction)?.set({ faction: this.faction, leader: this.leader!.index, cards: this.deck.filter((x) => x.count > 0) })
  }

  loadOpponentDeck(deck: unknown, silent = true) {
    const loadedDeck = this.loadDeck(deck, silent)
    if (!loadedDeck) return
    this.opponentData = loadedDeck
    Settings.opponentDeckCustom.set(loadedDeck)
  }

  clearOpponentDeck() {
    Settings.opponentDeckCustom.clear()
    this.opponentData = Settings.opponentDeckCustom.get() as DeckMaker['opponentData']
  }

  viewOponentCards() {
    if (isEmpty(this.opponentData)) return
    const data = this.opponentData as { leader: number; cards: IdCount[] }
    const leader = { index: data.leader, count: 1 }
    const container = new CardContainer()
    container.cards = Card.getCardsFromIdCounts([leader, ...data.cards])
    ui.queueCarousel(container, 1, () => {}, () => true, false, true, 'carousel.opponentDeck')
  }
}

let instance: DeckMaker | null = null
export function useDeckMaker() {
  if (!instance) instance = new DeckMaker()
  return instance
}
