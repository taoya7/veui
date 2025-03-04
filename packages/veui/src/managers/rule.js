import Vue from 'vue'
import { isObject, isFunction } from 'lodash'
import required from './rules/required'
import maxLength from './rules/maxLength'
import minLength from './rules/minLength'
import max from './rules/max'
import min from './rules/min'
import numeric from './rules/numeric'
import pattern from './rules/pattern'
import { renderTpl } from '../utils/helper'
import type from './type'

export class Rule {
  constructor () {
    this.ruleValidators = new Vue({
      data: {
        required,
        maxLength,
        minLength,
        max,
        min,
        numeric,
        pattern
      }
    })
  }

  validate (val, rules, context) {
    if (!rules || !rules.length) {
      return true
    }

    rules = Array.isArray(rules) ? rules : [rules]
    let contextData = type.clone(context)
    let results = rules.map(({ name, value: ruleValue, message }) => {
      let validator = this.ruleValidators[name]
      if (!validator.validate(val, ruleValue, contextData)) {
        let realMessage = message || validator.message
        return {
          name: name,
          message: isFunction(realMessage)
            ? realMessage(val, ruleValue)
            : renderTpl(realMessage, { ruleValue, value: val }, true)
        }
      }
      // 代表没错
      return true
    })

    // 只返回出错的就好
    results = results.filter((res) => isObject(res))
    return results.length ? results : true
  }

  initRules (rules) {
    // 根据优先级排一下显示顺序
    rules.sort((x, y) => {
      let priorityX = x.priority || this.ruleValidators[x.name].priority
      let priorityY = y.priority || this.ruleValidators[y.name].priority
      return priorityX >= priorityY
    })
  }

  addRule (rule, validator) {
    if (!(rule in this.ruleValidators)) {
      this.ruleValidators[rule] = validator
    }
  }
}

export default new Rule()
