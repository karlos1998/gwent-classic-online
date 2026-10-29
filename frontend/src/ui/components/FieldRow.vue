<template>
  <div class="field-row" :data-row="row.type">
    <div class="row-score center">{{ displayTotal }}</div>
    <div
      :ref="registerContainer(row.key + '-special')"
      class="row-special card-container"
      :class="{ 'row-selectable': row.ui.specialSelectable, noclick: row.ui.specialNoclick }"
      @click="ui.selectRow(row)"
    >
      <CardView v-if="row.special" :key="row.special.uid" :card="row.special" @select="ui.selectCard($event)" />
    </div>
    <div
      :ref="registerContainer(row.key)"
      class="row-cards card-container"
      :class="{ 'row-selectable': row.ui.selectable, noclick: row.ui.noclick, 'card-selectable': row.ui.cardSelectable }"
      @click.capture="ui.selectRow(row)"
    >
      <CardView
        v-for="c in row.cards"
        :key="c.uid"
        :card="c"
        :margin="margin"
        @select="ui.selectCard($event)"
      />
    </div>
    <div
      class="row-weather"
      :class="[row.overlay.cls, { hide: row.overlay.hidden }]"
      :style="row.overlay.opacity !== null ? { opacity: row.overlay.opacity } : {}"
    ></div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, type PropType } from 'vue'
import { ctx, type Row } from '@/engine'
import CardView from './CardView.vue'
import { ui } from '../store'
import { registerContainer } from '../dom'
import { ROW_MARGIN } from '../layout'

export default defineComponent({
  name: 'FieldRow',
  components: { CardView },
  props: {
    row: { type: Object as PropType<Row>, required: true },
  },
  setup(props) {
    const margin = computed(() => ROW_MARGIN(props.row.cards.length))
    // the original markup shipped "12" as placeholder in the opponent's siege row before the first game
    const displayTotal = computed(() => (props.row.index === 0 && !ctx.me ? 12 : props.row.total))
    return { ui, margin, displayTotal, registerContainer }
  },
})
</script>
