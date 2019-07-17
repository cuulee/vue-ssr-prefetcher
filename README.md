# vue-ssr-prefetcher

<a href="https://circleci.com/gh/shuidi-fed/vue-ssr-prefetcher/tree/master"><img src="https://img.shields.io/circleci/build/github/shuidi-fed/vue-ssr-prefetcher/master.svg" alt="build status"/></a>
[![](https://img.shields.io/npm/v/vue-ssr-prefetcher.svg)](https://www.npmjs.com/package/vue-ssr-prefetcher)
<a href="https://github.com/shuidi-fed/vue-ssr-prefetcher"><img src="https://img.shields.io/github/license/shuidi-fed/vue-ssr-prefetcher.svg" alt="License"/></a>
<a href="http://commitizen.github.io/cz-cli/"><img src="https://img.shields.io/badge/commitizen-friendly-brightgreen.svg" alt="Commitizen friendly"/></a>

Making Vue SSR's data prefetching more intuitive.(Only `1kb` compressed)

## Why?

The way to perform data prefetching in Vue's server-side rendering can be summarized as two types, one is the `asyncData` scheme represented by `nuxt/ream`, and the other is the `serverPrefetch` component option provided by Vue. However, both options have some drawbacks:

- `nuxt/ream`'s `asyncData`：
  - Can't access `this`
  - Can only be used for routing components (or `page` components)
  - Need to expose data to the rendering environment by returning an object(or `promise`)
- `ServerPrefetch` natively provided by `Vue`：
  - Can only run on the server side, the client needs to write additional logic to fetch data, and should avoid repeated data fetch.
  - Can only prefetch `store` data, can't expose data to component-level rendering environment and send it to client

Both of the above options have a common drawback: **Not intuitive**, So `vue-ssr-prefetcher` provides a more intuitive data prefetching scheme. In other words, you don't see any traces of SSR in the process of prefetching data, just like writing a SPA application.

## Installation

```sh
yarn add vue-ssr-prefetcher
```

Or use `npm`:

```sh
npm install vue-ssr-prefetcher --save
```

## Usage

`vue-ssr-prefetcher` provides two `vue` plugins: `serverPlugin` and `clientPlugin` for `server entry` and `client entry` respectively.

### In `server entry`:：

```js
import Vue from 'vue'
import createApp from './createApp'
// 1. Import plugin
import { serverPlugin } from 'vue-ssr-prefetcher'

// 2. Install plugin
Vue.use(serverPlugin)

export default async context => {
  const { app, router, store } = createApp()

  router.push(context.url)

  await routerReady(router)

  // 3. Set `context.rendered` to `serverPlugin.done`
  context.rendered = serverPlugin.done

  context.state = {
    $$stroe: store ? store.state : undefined,
    // 4. `app.$$selfStore` is a property injected by the serverPlugin
    $$selfStore: app.$$selfStore
  }

  return app
}

function routerReady (router) {
  return new Promise(resolve => {
    router.onReady(resolve)
  })
}
```

`serverPlugin` will inject the `app.$$selfStore` property on the root component instance and store the component-level data. You just need to add it to `context.state`. In addition, you also need to set `context.rendered` to `serverPlugin.done`.

### 在 `client entry` 中：

```js
import Vue from 'vue'
import createApp from './createApp'
// 1. Import plugin
import { clientPlugin } from 'vue-ssr-prefetcher'
// 2. Install plugin
Vue.use(clientPlugin)

const { app, router, store } = createApp()

router.onReady(() => {
  // 3. Deconstructing `$$selfStore` from `window.__INITIAL_STATE__`
  const { $$selfStore } = window.__INITIAL_STATE__

  // 4. Add `$$selfStore` to the root component instance
  if ($$selfStore) app.$$selfStore = $$selfStore

  app.$mount('#app')
  // 5. This is very important, it is used to avoid repeated data fetch,
  //    and must be after the `$mount()` function
  clientPlugin.$$resolved = true
})
```

### Let's see how to do data prefetching next.

After the configuration is complete as described above, you can send the request to prefetch data in the `created` hook of any component:

```js
export default {
  name: 'Example',
  data() {
    return { name: 'Hcy' }
  },
  async created() {

    // The `this.$createFetcher()` function is injected by clientPlugin,
    // it receives a function that returns a promise as a parameter, 
    // such as the api function used to send the request
    const fetcher = this.$createFetcher(fetchName)

    const res = await fetcher()

    this.name = res.name
  }
}
```

As shown in the code above, the only difference from the past is that you need to call the `this.$createFetcher` function to create a `fetcher`. In fact, `this.$createFetcher` does things very simple. Here is the source code:

```js
Vue.prototype.$createFetcher = function(fetcher) {
  const vm = this
  return function(params: any) {
    const p = fetcher(params)
    vm.$$promises.push(p)
    return p
  }
}
```

It's just a simple wrapper, so we can think of the `fetcher` created by the `this.$createFetcher` function as the original function.

Although it looks no different than developing the `SPA` app, `vue-ssr-prefetcher` does a lot for you, let's compare it:

|            | Can access `this` | used for any component  | Used for both server and client     | Prefetch component level data    |
| ---------- | :-----------:  | :-----------: | :-----------: | :-----------: |
| `nuxt/ream`'s `asyncData`   | ❌           | ❌     | ✅       | ✅     |
| `ServerPrefetch` provided by `Vue` | ✅           | ✅     | ❌       | ❌     |
| `vue-ssr-prefetcher`         | ✅           | ✅     | ✅       | ✅     |

Of course, `vue-ssr-prefetcher` is also done for you:

- Avoid repeating data fetch
- Should be able to send requests normally when the route jumps

**And you don't need to do anything. The only thing you need to do is create a `fetcher` using `this.$createFetcher` function, but this is really straightforward, no black technology.**
