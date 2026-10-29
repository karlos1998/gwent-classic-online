// Faction perks - ported 1:1 from the original factions.js (display names/descriptions: i18n factions.*)
import { ctx } from './context'
import { ControllerAI } from './ai'
import { HandAI } from './containers'
import type { Player } from './player'
import { randomInt } from './util'
import type { Card } from './card'
import type { Row } from './containers'

export interface FactionDef {
  factionAbility?: (player: Player) => void
  helper?: (player: Player) => Promise<void>
}

export const factions: Record<'realms' | 'nilfgaard' | 'monsters' | 'scoiatael' | 'skellige', FactionDef> = {
  realms: {
    factionAbility: (player) =>
      ctx.game.roundStart.push(async () => {
        if (ctx.game.roundCount > 1 && ctx.game.roundHistory[ctx.game.roundCount - 2].winner === player) {
          player.deck.draw(player.hand)
          await ctx.ui.notification('north', 1200)
        }
        return false
      }),
  },
  nilfgaard: {
  },
  monsters: {
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
  },
  scoiatael: {
    factionAbility: (player) =>
      ctx.game.gameStart.push(async () => {
        let notif = ''
        if (player === ctx.me) {
          await ctx.ui.popup(
            'popup.goFirst',
            () => (ctx.game.firstPlayer = player),
            'popup.letOpponentStart',
            () => (ctx.game.firstPlayer = player.opponent()),
            'popup.scoiataelTitle',
            'popup.scoiataelDescription',
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
  },
  skellige: {
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
  },
}
