import { pick, uniqueId, get } from 'lodash'
import { getTypedAncestorTracker } from '../utils/helper'
import { getIndexOfType } from '../utils/context'

export default {
  uiTypes: ['menu-item'],
  data () {
    return {
      id: uniqueId('veui-menu-item-')
    }
  },
  computed: getTypedAncestorTracker('menu').computed,
  created () {
    if (!this.menu || !this.renderForData) {
      return
    }
    let index = getIndexOfType(this, 'menu')
    let label = this.label || this.getLabelNaive()
    this.menu.add({
      ...pick(this, [
        'value',
        'items',
        'id',
        'position',
        'trigger',
        'disabled'
      ]),
      label,
      index,
      renderLabel:
        this.$scopedSlots.label || (() => this.$slots.label || label),
      renderBefore: () =>
        this.$scopedSlots.before
          ? this.$scopedSlots.before()
          : this.$slots.before,
      renderAfter: () =>
        this.$scopedSlots.after ? this.$scopedSlots.after() : this.$slots.after
    })
  },
  destroyed () {
    if (!this.menu) {
      return
    }
    this.menu.removeById(this.id)
  },
  methods: {
    getLabelNaive () {
      return get(this, '$vnode.componentOptions.children[0].text', '')
    }
  }
}
