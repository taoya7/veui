<template>
<div
  :ui="realUi"
  :class="{
    [$c('field')]: true,
    [$c('invalid')]: invalid,
    [$c('field-abstract')]: realAbstract,
    [$c('field-no-label')]: !realAbstract && !label && !$slots.label,
    [$c('field-required')]: isRequired
  }"
>
  <div
    v-if="(!realAbstract && label) || $slots.label"
    :class="$c('field-label')"
  >
    <slot name="label">
      <veui-label>{{ label }}</veui-label>
    </slot>
    <div
      v-if="tip || $slots.tip"
      :class="$c('field-tip')"
    >
      <veui-icon
        ref="tip"
        :name="icons.tip"
      />
      <veui-tooltip
        :ui="uiParts.tip"
        target="tip"
        position="top-start"
      >
        <slot name="tip">{{ tip }}</slot>
      </veui-tooltip>
    </div>
  </div>
  <div :class="$c('field-main')">
    <div :class="$c('field-content')">
      <slot
        :listeners="interactiveListeners"
        :invalid="invalid"
        :validities="validities"
        :readonly="realReadonly"
        :disabled="realDisabled"
      />
    </div>
    <div
      v-if="!realAbstract"
      :class="$c('field-messages')"
    >
      <veui-loading
        v-if="validating"
        :loading="validating"
      >{{
        t('validating')
      }}</veui-loading>
      <template v-else-if="validationStatus !== 'success'">
        <template v-for="(validity, index) in renderableValidities">
          <component
            :is="{ render: validity.render }"
            v-if="validity.render"
            :key="index"
            :validity="validity"
          />
          <veui-message
            v-else
            :key="index"
            :ui="uiParts.message"
            :title="validity.message"
            :status="validity.status"
            :display="realValidityDisplay"
          >
            <span>{{ validity.message }}</span>
          </veui-message>
        </template>
      </template>
      <veui-message
        v-if="(help || $scopedSlots.help) && helpPosition === 'bottom'"
        :ui="uiParts.message"
        status="aux"
        display="simple"
        :class="$c(`field-help-content-${helpPosition}`)"
      >
        <slot name="help">{{ help }}</slot>
      </veui-message>
    </div>
  </div>
  <veui-message
    v-if="(help || $scopedSlots.help) && helpPosition === 'side'"
    :ui="uiParts.message"
    status="aux"
    display="simple"
    :class="$c(`field-help-content-${helpPosition}`)"
  >
    <slot name="help">{{ help }}</slot>
  </veui-message>
</div>
</template>

<script>
import Label from '../Label'
import Loading from '../Loading'
import Message from '../Message'
import type from '../../managers/type'
import prefix from '../../mixins/prefix'
import ui from '../../mixins/ui'
import i18n from '../../mixins/i18n'
import useConfig from '../../mixins/config'
import config from '../../managers/config'
import { get, last, find, uniq } from 'lodash'
import { getVnodes } from '../../utils/context'
import { getTypedAncestor, pull } from '../../utils/helper'
import Icon from '../Icon'
import Tooltip from '../Tooltip'
import Vue from 'vue'
import '../../common/global'
import { useCoupled, useFacade } from './_facade'
import useRule from './_useRule'
import { useFormChild } from './Form'
import { ValidityStatus, normalizeValidities } from './_useValidity'

const { useParent: useFieldParent, useChild: useFieldChild } =
  useCoupled('form-field')

export { useFieldChild }

const { ERROR, WARNING, SUCCESS } = ValidityStatus

config.defaults(
  {
    validityDisplay: 'simple'
  },
  'field'
)

export default {
  name: 'veui-field',
  uiTypes: ['form-field', 'form-container'],
  components: {
    'veui-icon': Icon,
    'veui-label': Label,
    'veui-tooltip': Tooltip,
    'veui-loading': Loading,
    'veui-message': Message
  },
  mixins: [
    prefix,
    ui,
    i18n,
    useConfig('config', 'field'),
    // 直接用 decorator 在方法上标更好？
    useFacade((vm) => ({
      isDisabled: () => (vm.withholdValidity ? false : vm.realDisabled),
      isReadonly: () => (vm.withholdValidity ? false : vm.realReadonly),
      isInvalid: (input) => (vm.isPassThrough(input) ? vm.invalid : false),
      getInteractiveListeners: (input) =>
        vm.isPassThrough(input) ? vm.interactiveListeners : {},
      isFieldset: () => vm.isFieldset,
      isAbstract: () => vm.realAbstract,
      getAbstractFieldNames: () => vm.abstractFieldNames,
      getName: () => vm.realName,
      getField: () => vm.realField,
      getFieldValue: vm.getFieldValue,
      resetValue: vm.resetValue,
      validate: vm.validate,
      updateInputValidities: vm.updateInputValidities,
      // this 和 parentField 之间没有 input 即返回 true, 调用方保证 parentField 和 vm 的父子关系
      isDirectSubField: (parentField) =>
        !getTypedAncestor(vm, 'input', parentField),
      addInput (input) {
        vm.inputs.push(input)
        return () => pull(vm.inputs, input)
      },
      addField (field) {
        vm.fields.push(field)
        return () => pull(vm.fields, field)
      }
    })),
    useFieldParent((vm) => vm.getFacade()),
    useFormChild('form', (vm) => vm.form.addField(vm.getFacade())),
    useFieldChild('parentField', (vm) =>
      vm.parentField.addField(vm.getFacade())
    ),
    useRule('rule', {
      getRules: (vm) => vm.rules,
      getFieldValue: (vm) => vm.getFieldValue()
    })
  ],
  props: {
    label: String,
    name: String,
    tip: String,
    disabled: Boolean,
    readonly: Boolean,
    rules: [String, Array],
    field: String,
    help: String,
    helpPosition: {
      type: String,
      default: 'side',
      validator (value) {
        return ['bottom', 'side'].indexOf(value) >= 0
      }
    },
    validityDisplay: {
      type: String,
      validator (value) {
        return ['normal', 'simple'].indexOf(value) >= 0
      }
    },
    abstract: Boolean, // 无label（无margin），不展示错误信息
    withholdValidity: Boolean // 不自动invalid，不自动listener，不自动 disabled 和 readonly
  },
  data () {
    return {
      inputs: [],
      /**
       * 多个规则同时校验会根据规则的优先级进行排序，显示优先级最高的错误。
       * 但是如果中间有交互式的检查，交互顺序会打破优先级的排序。
       * 比如配置了 input 和 change 时校验两个不同级别的规则，
       * 输入了两种规则都不匹配的值：
       * 1. 会在输入过程显示 input 指定的错误消息；
       * 2. 失去焦点显示 change 指定的错误消息；
       * 3. 提交时显示级别高的那个错误消息；
       * 4. 单次交互校验内部多规则遵从优先级排序
       *
       * fields 复数命名主要是兼容 validator 的多 field 错误显示
       *
       * @type {Array<fields, message, valid>}
       */
      initialData: null,
      fields: []
    }
  },
  computed: {
    realDisabled () {
      return (
        this.disabled ||
        (!!this.parentField && this.parentField.isDisabled()) ||
        (!!this.form && this.form.isDisabled())
      )
    },
    realReadonly () {
      return (
        this.readonly ||
        (!!this.parentField && this.parentField.isReadonly()) ||
        (!!this.form && this.form.isReadonly())
      )
    },
    realValidityDisplay () {
      return this.validityDisplay || this.config['field.validityDisplay']
    },
    validating () {
      return this.form.isValidating(this.validityKeys)
    },
    primaryInput () {
      const { inputs, realName } = this
      let primary
      if (inputs.length !== 1) {
        primary = find(inputs, (input) => input.getDeclaredName() === realName)
      }

      return primary || inputs[0]
    },
    isFieldset () {
      const uiTypes = getVnodes(this)[0].context.$options.uiTypes || []
      return uiTypes.indexOf('fieldset') >= 0
    },
    inFieldset () {
      return this.parentField ? this.parentField.isFieldset() : false
    },
    hasDirectSubField () {
      return this.fields.some((field) => field.isDirectSubField(this))
    },
    // 不自动和 input 联动，当 Field 下面直接嵌套 Field 那么所有自动绑定都会取消
    realWithhold () {
      return this.withholdValidity || this.isFieldset || this.hasDirectSubField
    },
    validities () {
      return this.form ? this.form.getValiditiesOf(this.validityKeys) : []
    },
    validityKeys () {
      return this.realAbstract
        ? this.realName
          ? [this.realName]
          : []
        : this.abstractFieldNames
    },
    abstractFieldNames () {
      return this.fields.reduce(
        (acc, ch) => {
          return ch.isAbstract() ? acc.concat(ch.getAbstractFieldNames()) : acc
        },
        this.realName ? [this.realName] : []
      )
    },
    renderableValidities () {
      return this.validities.filter(
        ({ message, render }) => !!message || !!render
      )
    },
    invalid () {
      return !this.validating && !!this.errors.length
    },
    errors () {
      return this.validities.filter(({ status }) => status === ERROR)
    },
    validationStatus () {
      let result = SUCCESS
      this.validities.some(({ status }) => {
        const isError = status === ERROR
        if (isError || status === WARNING) {
          result = status
        }
        return isError
      })
      return result
    },
    realAbstract () {
      return this.abstract || this.inFieldset
    },
    isRequired () {
      return this.rule.getRules().some((perRule) => perRule.name === 'required')
    },
    interactiveListeners () {
      let allEvents = []
      const { form, realName, rule, handleInteract } = this
      if (form) {
        let events = form.getInteractiveEvents()[realName]
        if (events) {
          allEvents = allEvents.concat(events)
        }
      }
      allEvents = allEvents.concat(Object.keys(rule.getInteractiveRuleRecord()))
      return uniq(allEvents).reduce((acc, eventName) => {
        acc[eventName] = () => handleInteract(eventName)
        return acc
      }, {})
    },
    realField () {
      return this.field || this.name
    },
    realName () {
      return this.name || this.field
    }
  },
  created () {
    // 如果是 fieldset 或者没写 field，初始值和校验都没有意义
    if (!this.realField) {
      return
    }

    this.initialData = type.clone(this.getFieldValue())
  },
  methods: {
    getFieldValue () {
      this.assertForm()
      return get(this.form.getFormData(), this.realField)
    },
    assertForm () {
      const { form } = this
      if (!form) {
        throw new Error('veui fields should be used in a form scope.')
      }
    },
    isPassThrough (input) {
      const fieldsetLike = this.isFieldset || this.hasDirectSubField
      return (
        !this.withholdValidity &&
        !fieldsetLike &&
        input &&
        input === this.primaryInput
      )
    },
    updateInputValidities (validities) {
      this.assertForm()
      this.form.updateInputValidities(
        this.realName,
        normalizeValidities(validities)
      )
    },
    validate (rules) {
      if (this.isFieldset) {
        return
      }

      this.assertForm()
      const { form, realName, primaryInput, rule } = this
      const result = rule.validate(form.getFormData(), rules)

      const ruleNames = rules ? rules.map((rule) => rule.name) : null
      form.updateRuleValidities(realName, ruleNames, result)

      // 整体都校验时，输入组件的内置校验也校验下
      if (
        !rules &&
        primaryInput &&
        typeof primaryInput.validate === 'function'
      ) {
        const inputResult = normalizeValidities(primaryInput.validate())
        if (inputResult !== true) {
          return (result === true ? [] : result).concat(inputResult)
        }
      }
      return result
    },
    handleInteract (eventName) {
      // 需要让对应的 data 更新完值之后，再去 validate，都要 nextTick 来保证
      this.$nextTick(() => {
        this.assertForm()

        const { form, rule } = this
        const rules = rule.getInteractiveRuleRecord()[eventName]
        let result = rules ? this.validate(rules) : {}
        result = result === true ? {} : result

        form.validateForEvent(eventName, this.realName, result)
      })
    },
    resetValue () {
      if (!this.realField) {
        return
      }

      this.assertForm()
      // 清空错误消息，为什么要先做，因为有可能是个fieldset，可以清错误，但是没有值
      if (this.realName) {
        this.form.clearValiditiesOfField(this.realName)
      }

      let path = this.realField.split('.')
      let name = last(path)
      let parentPath
      let match = /(\w+)\[(\d+)\]/.exec(name)
      if (match && match[1]) {
        parentPath = [...path.slice(0, -1), match[1]]
        name = match[2]
      } else {
        parentPath = path.slice(0, -1)
      }

      let parentValue = parentPath.length
        ? get(this.form.getFormData(), parentPath.join('.'))
        : this.form.getFormData()
      Vue.set(parentValue, name, type.clone(this.initialData))
    }
  }
}
</script>
