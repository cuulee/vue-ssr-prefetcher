import Vue, { VueConstructor, ComponentOptions } from 'vue'

interface Fetcher {
  (params: any): Promise<any>
}

let uid = 0

export const serverPlugin = (Vue: VueConstructor) => {
  const originalInit = Vue.prototype._init
  Vue.prototype._init = function(this: Vue, options: ComponentOptions<Vue>) {
    this.$$uid = uid++
    originalInit.call(this, options)
  }

  Vue.prototype.$createFetcher = function(this: Vue, fetcher: Fetcher) {
    const vm = this
    return function(params: any) {
      const p = fetcher(params)
      vm.$$promises.push(p)
      return p
    }
  }

  Vue.mixin({
    serverPrefetch() {
      return Promise.all(this.$$promises) as any
    },
    data() {
      this.$$promises = []

      return {}
    },
    created(this: Vue) {
      const $$selfStore =
        this.$root.$$selfStore || (this.$root.$$selfStore = {})
      $$selfStore[this.$$uid] = this.$data
    }
  })
}

// reset
serverPlugin.done = () => (uid = 0)

export const clientPlugin = (Vue: VueConstructor) => {
  Vue.prototype.$createFetcher = function(fetcher: Fetcher) {
    const vm = this
    console.log('this.$root.$$resolved: ', this.$root.$$resolved)
    return function(params: any) {
      if (!vm.$root.$$resolved) return vm.$root.$$selfStore[vm._uid]

      return fetcher(params)
    }
  }

  Vue.mixin({
    data() {
      const $$selfStore = this.$root.$$selfStore

      if (!$$selfStore) return {}

      console.log('Prefetch Data: ', $$selfStore[this._uid])
      return { ...($$selfStore[this._uid] || {}) }
    }
  })
}
