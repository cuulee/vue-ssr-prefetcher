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

export const clientPlugin = (Vue: VueConstructor, options = { stop: true }) => {
  Vue.prototype.$createFetcher = function(fetcher: Fetcher) {
    return function(params: any) {
      if (!clientPlugin.$$resolved) {
        throw new Error('vue-ssr-prefetcher: custom error')
      }

      return fetcher(params)
    }
  }

  Vue.mixin({
    created() {
      const $$selfStore = this.$root.$$selfStore
      if (clientPlugin.$$resolved || !$$selfStore) return

      Object.assign(this, $$selfStore[this._uid] || {})
    },
    errorCaptured() {
      return !options.stop
    }
  })
}

clientPlugin.$$resolved = false
