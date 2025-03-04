import { config } from '@vue/test-utils'
import sinon from 'sinon'
import ConfirmBox from '@/components/ConfirmBox'
import { wait, mount } from '../../../utils'

config.stubs.transition = false

describe('components/ConfirmBox', function () {
  it('should handle props correctly', async () => {
    let closeHandler = sinon.spy()
    let wrapper = mount({
      components: {
        'veui-confirm-box': ConfirmBox
      },
      data () {
        return {
          open: true,
          closeHandler
        }
      },
      template:
        '<veui-confirm-box title="title" :open.sync="open" :before-close="closeHandler" />'
    })
    let { vm } = wrapper
    expect(wrapper.find('.veui-dialog-content-head-title').text()).to.equal(
      'title'
    )
    let buttons = wrapper.findAll('.veui-button')
    buttons.at(0).trigger('click')
    await vm.$nextTick()
    expect(vm.open).to.equal(false)
    vm.open = true
    await vm.$nextTick()
    buttons = wrapper.findAll('.veui-button')
    buttons.at(1).trigger('click')
    await vm.$nextTick()
    expect(vm.open).to.equal(false)
    expect(closeHandler.callCount).to.equal(2)
    wrapper.destroy()
  })

  it('should render slot correctly', () => {
    let wrapper = mount(ConfirmBox, {
      propsData: {
        open: true
      },
      slots: {
        title: '<div class="title-slot" slot="title">title</div>',
        default: '<div class="content-slot">content</div>',
        foot: '<div class="foot-slot" slot="foot">foot</div>'
      }
    })
    expect(wrapper.find('.title-slot').text()).to.equal('title')
    expect(wrapper.find('.content-slot').text()).to.equal('content')
    expect(wrapper.find('.foot-slot').text()).to.equal('foot')
    wrapper.destroy()
  })

  it('should handle event correctly when click ok/cancel button', async function () {
    this.timeout(3000)

    let okHandler = sinon.spy()
    let cancelHandler = sinon.spy()
    let afterCloseHandler = sinon.spy()
    let wrapper = mount(
      {
        components: {
          'veui-confirm-box': ConfirmBox
        },
        data () {
          return {
            open: true
          }
        },
        methods: {
          okHandler,
          cancelHandler,
          afterCloseHandler
        },
        template: `
          <veui-confirm-box
            :open.sync="open"
            title="Confirm"
            @ok="okHandler"
            @cancel="cancelHandler"
            @afterclose="afterCloseHandler">
            Are you sure you wan to continue?
          </veui-confirm-box>
        `
      },
      {
        attachToDocument: true
      }
    )
    let buttons = wrapper.findAll('.veui-button')
    buttons.at(0).trigger('click')
    await wait(600)
    expect(okHandler.calledOnce).to.equal(true)
    wrapper.vm.open = true
    await wrapper.vm.$nextTick()
    buttons = wrapper.findAll('.veui-button')
    buttons.at(1).trigger('click')
    await wait(600)
    expect(cancelHandler.calledOnce).to.equal(true)
    expect(afterCloseHandler.callCount).to.equal(2)
    wrapper.destroy()
  })

  it('should make prop `open` fully controlled', async () => {
    let wrapper = mount(
      {
        components: {
          'veui-confirm-box': ConfirmBox
        },
        data () {
          return {
            open: true
          }
        },
        template: `
          <veui-confirm-box
            :open="open"
            title="Confirm">
            Are you sure you wan to continue?
          </veui-confirm-box>
        `
      },
      {
        attachToDocument: true
      }
    )
    let buttons = wrapper.findAll('.veui-button')
    buttons.at(0).trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.veui-confirm-box').isVisible()).to.equal(true)
    buttons.at(1).trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.veui-confirm-box').isVisible()).to.equal(true)
    wrapper.destroy()
  })

  it('should respect `loading` and `disabled` props', async () => {
    let wrapper = mount({
      components: {
        'veui-confirm-box': ConfirmBox
      },
      data () {
        return {
          disabled: false,
          loading: false
        }
      },
      template:
        '<veui-confirm-box open :disabled="disabled" :loading="loading"/>'
    })

    let { vm } = wrapper
    let btn = wrapper.find('.veui-dialog-content-foot .veui-button:first-child')
    expect(btn.classes('veui-disabled')).to.equal(false)
    expect(btn.classes('veui-button-loading')).to.equal(false)

    vm.disabled = true
    await vm.$nextTick()
    expect(btn.classes('veui-disabled')).to.equal(true)
    expect(btn.classes('veui-button-loading')).to.equal(false)

    vm.disabled = false
    vm.loading = true
    await vm.$nextTick()
    expect(btn.classes('veui-disabled')).to.equal(false)
    expect(btn.classes('veui-button-loading')).to.equal(true)

    wrapper.destroy()
  })

  it('should respect `ok-label` and `cancel-label` props', async () => {
    let wrapper = mount({
      components: {
        'veui-confirm-box': ConfirmBox
      },
      data () {
        return {
          disabled: false,
          loading: false
        }
      },
      template: '<veui-confirm-box open ok-label="👍" cancel-label="👎"/>'
    })

    await wrapper.vm.$nextTick()

    let btns = wrapper.findAll('.veui-dialog-content-foot .veui-button')
    expect(btns.at(0).text()).to.equal('👍')
    expect(btns.at(1).text()).to.equal('👎')

    wrapper.destroy()
  })
})
