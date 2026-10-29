// Faction perks - ported 1:1 from the original factions.js
import { ctx } from './context'
import { ControllerAI } from './ai'
import { HandAI } from './containers'
import type { Player } from './player'
import { randomInt } from './util'
import type { Card } from './card'
import type { Row } from './containers'

export interface FactionDef {
  name: string
  description: string
  factionAbility?: (player: Player) => void
  helper?: (player: Player) => Promise<void>
}

export const factions: Record<'realms' | 'nilfgaard' | 'monsters' | 'scoiatael' | 'skellige', FactionDef> = {
  realms: {
    name: 'Northern Realms',
    factionAbility: (player) =>
      ctx.game.roundStart.push(async () => {
        if (ctx.game.roundCount > 1 && ctx.game.roundHistory[ctx.game.roundCount - 2].winner === player) {
          player.deck.draw(player.hand)
          await ctx.ui.notification('north', 1200)
        }
        return false
      }),
    description: 'Draw a card from your deck whenever you win a round.',
  },
  nilfgaard: {
    name: 'Nilfgaardian Empire',
    description: 'Wins any round that ends in a draw.',
  },
  monsters: {
    name: 'Monsters',
    factionAbility: (player) =>
      ctx.game.roundEnd.push(() => {
        const units = ctx.board.row
          .filter((_r, i) => (player === ctx.me) !== i < 3)
          .reduce<Card[]>((a, r) => r.cards.filter((c) => c.isUnit()).concat(a), [])
        if (units.length === 0) return
        const card = units[randomInt(units.length)]
        card.noRemove = true
        ctx.game.roundStart.push(async () => {
          await ctx.ui.notification('monsters', 1200)
          delete card.noRemove
          return true
        })
        return false
      }),
    description: 'Keeps a random Unit Card out after each round.',
  },
  scoiatael: {
    name: "Scoia'tael",
    factionAbility: (player) =>
      ctx.game.gameStart.push(async () => {
        let notif = ''
        if (player === ctx.me) {
          await ctx.ui.popup(
            'Go First',
            () => (ctx.game.firstPlayer = player),
            'Let Opponent Start',
            () => (ctx.game.firstPlayer = player.opponent()),
            'Would you like to go first?',
            "The Scoia'tael faction perk allows you to decide who will get to go first.",
            0.55,
          )
          notif = ctx.game.firstPlayer!.tag + '-first'
        } else if (player.hand instanceof HandAI) {
          if (Math.random() < 0.5) {
            ctx.game.firstPlayer = player
            notif = 'scoiatael'
          } else {
            ctx.game.firstPlayer = player.opponent()
            notif = ctx.game.firstPlayer.tag + '-first'
          }
        } else {
          //sleepUntil(game.firstPlayer); //TODO online
        }
        await ctx.ui.notification(notif, 1200)
        return true
      }),
    description: 'Decides who takes first turn.',
  },
  skellige: {
    name: 'Skellige',
    factionAbility: (player) =>
      ctx.game.roundStart.push(async () => {
        if (ctx.game.roundCount != 3) return false
        const currPlayer = ctx.game.currPlayer
        ctx.game.currPlayer = player
        await ctx.ui.notification('skellige-' + player.tag, 1200)
        if (player.controller instanceof ControllerAI) {
          await Promise.all(
            player.grave.findCardsRandom((c) => c.isUnit(), 2).map((c) => ctx.board.toRow(c, player.grave)),
          )
        } else {
          await factions['skellige'].helper!(player)
          await factions['skellige'].helper!(player)
        }
        ctx.game.currPlayer = currPlayer
        return true
      }),
    helper: async (player) => {
      const units = player.grave.findCardsRandom((c) => c.isUnit(), 1)
      if (units.length === 0) return
      const card = units[0]
      if (card.row === 'agile') {
        const selectedRow: Row | null = await ctx.ui.waitForRowSelection(card)
        if (selectedRow) await ctx.board.moveTo(card, selectedRow, player.grave)
      } else {
        await ctx.board.toRow(card, player.grave)
      }
    },
    description:
      '2 random cards from the graveyard are placed on the battlefield at the start of the third round.',
  },
}
