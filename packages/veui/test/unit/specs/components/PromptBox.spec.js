import { config } from '@vue/test-utils'
import sinon from 'sinon'
import PromptBox from '@/components/PromptBox'
import { wait, mount } from '../../../utils'

config.stubs.transition = false

describe('components/PromptBox', function () {
  it('shoule handle props correctly', async () => {
    let beforeCloseHandler = sinon.spy()
    let wrapper = mount(
      {
        components: {
          'veui-prompt-box': PromptBox
        },
        data () {
          return {
            open: true,
            beforeCloseHandler
          }
        },
        template: `
        <veui-prompt-box
          :open.sync="open"
          title="Prompt"
          :before-close="beforeCloseHandler"
          content="Please tell us your age:"
          value="18" />
        `
      },
      {
        sync: false
      }
    )
    let { vm } = wrapper
    expect(wrapper.find('.veui-dialog-content-head-title').text()).to.equal(
      'Prompt'
    )
    expect(wrapper.find('.veui-prompt-box-info').text()).to.equal(
      'Please tell us your age:'
    )
    expect(wrapper.find('.veui-input').vm.value).to.equal('18')
    wrapper.find('.veui-button').trigger('click')
    await wait(0)
    expect(vm.open).to.equal(false)
    expect(beforeCloseHandler.calledOnce).to.equal(true)
    wrapper.destroy()
  })

  it('should render slots correctly', () => {
    let wrapper = mount(PromptBox, {
      propsData: {
        open: true
      },
      slots: {
        default: '<div class="default-slot">content</div>',
        title: '<div class="title-slot" slot="title">title</div>',
        foot: '<div class="foot-slot" slot="foot">foot</div>'
      },
      sync: false
    })
    expect(wrapper.find('.title-slot').text()).to.equal('title')
    expect(wrapper.find('.default-slot').text()).to.equal('content')
    expect(wrapper.find('.foot-slot').text()).to.equal('foot')
    wrapper.destroy()
  })

  it('should handle value correctly when submit value', async () => {
    let returnedValue
    let wrapper = mount(PromptBox, {
      propsData: {
        open: true
      },
      sync: false
    })
    let { vm } = wrapper
    let input = wrapper.find('input')
    vm.$on('ok', (value) => {
      returnedValue = value
    })
    input.setValue('18')
    input.trigger('keydown.enter')
    await vm.$nextTick()
    expect(returnedValue).to.equal('18')
    wrapper.destroy()
  })

  it('should handle event correctly when click ok/cancel button', async function () {
    this.timeout(3000)

    let okMock = sinon.spy()
    let cancelMock = sinon.spy()
    let afterCloseMock = sinon.spy()
    let wrapper = mount(
      {
        components: {
          'veui-prompt-box': PromptBox
        },
        data () {
          return {
            open: true
          }
        },
        methods: {
          ok (value) {
            expect(value).to.equal('18')
            okMock()
          },
          cancelMock,
          afterCloseMock
        },
        template: `
          <veui-prompt-box
            :open.sync="open"
            value="18"
            @ok="ok"
            @cancel="cancelMock"
            @afterclose="afterCloseMock" />
        `
      },
      {
        sync: false,
        attachToDocument: true
      }
    )
    let buttons = wrapper.findAll('.veui-button')
    buttons.at(0).trigger('click')
    await wait(600)
    expect(wrapper.vm.open, '#1').to.equal(false)
    wrapper.vm.open = true
    await wrapper.vm.$nextTick()
    buttons = wrapper.findAll('.veui-button')
    buttons.at(1).trigger('click')
    await wait(600)
    expect(wrapper.vm.open, '#2').to.equal(false)
    expect(okMock.calledOnce).to.equal(true)
    expect(cancelMock.calledOnce).to.equal(true)
    expect(afterCloseMock.callCount).to.equal(2)
    wrapper.destroy()
  })

  it('should make `open` prop and `value` prop fully controlled.', async () => {
    let wrapper = mount(
      {
        components: {
          'veui-prompt-box': PromptBox
        },
        data () {
          return {
            open: true,
            value: 'ok'
          }
        },
        template: `
          <veui-prompt-box
            :open="open"
            :value="value"/>
        `
      },
      {
        sync: false,
        attachToDocument: true
      }
    )
    let buttons = wrapper.findAll('.veui-button')
    buttons.at(0).trigger('click')
    await wait(600)
    expect(wrapper.find('.veui-prompt-box').isVisible()).to.equal(true)

    buttons.at(1).trigger('click')
    await wait(600)
    expect(wrapper.find('.veui-prompt-box').isVisible()).to.equal(true)

    let input = wrapper.find('.veui-input input')
    input.element.value = 'notok'
    input.trigger('input')
    await wrapper.vm.$nextTick()
    expect(input.element.value).to.equal('ok')
    wrapper.destroy()
  })

  it('should respect `loading` and `disabled` props', async () => {
    let wrapper = mount({
      components: {
        'veui-prompt-box': PromptBox
      },
      data () {
        return {
          disabled: false,
          loading: false
        }
      },
      template:
        '<veui-prompt-box open :disabled="disabled" :loading="loading"/>'
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
        'veui-prompt-box': PromptBox
      },
      data () {
        return {
          disabled: false,
          loading: false
        }
      },
      template: '<veui-prompt-box open ok-label="👍" cancel-label="👎"/>'
    })

    await wrapper.vm.$nextTick()

    let btns = wrapper.findAll('.veui-dialog-content-foot .veui-button')
    expect(btns.at(0).text()).to.equal('👍')
    expect(btns.at(1).text()).to.equal('👎')

    wrapper.destroy()
  })
})
