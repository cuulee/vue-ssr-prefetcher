# vue-ssr-prefetcher

[![](https://img.shields.io/npm/v/vue-ssr-prefetcher.svg)](https://www.npmjs.com/package/vue-ssr-prefetcher)
<a href="https://github.com/HcySunYang/vue-ssr-prefetcher"><img src="https://img.shields.io/npm/l/vue-ssr-prefetcher.svg" alt="License"/></a>
<a href="http://commitizen.github.io/cz-cli/"><img src="https://img.shields.io/badge/commitizen-friendly-brightgreen.svg" alt="Commitizen friendly"/></a>

为 `Vue` 的 `SSR` 提供更直观的数据预取方式（压缩后仅 `1kb`）。

## Why?

在 `Vue` 的服务端渲染中做数据预取的方式大概可以总结为两种，一种是以 `nuxt/ream` 为代表的 `asyncData` 方案，另一种是 `Vue` 原生提供的 `serverPrefetch` 组件选项。然而这两种方案都有一些缺点：

- `nuxt/ream` 的 `asyncData`：
  - 不能访问 `this`
  - 只能用于路由组件(或 `page` 组件)
  - 需要通过返回对象(或 `promise`)将数据暴露到渲染环境
- `Vue` 原生提供的 `serverPrefetch`：
  - 只运行于服务端，客户端需要另外编写数据获取逻辑，并避免数据的重复获取
  - 只能预取 `store` 数据，无法将数据暴露到组件级别的渲染环境并发送到客户端

以上两种方案还拥有一个共同的弊端：**不够直观**，`vue-ssr-prefetcher` 提供了一种更直观的数据预取方案，换句话说你在预取数据的过程中看不出来任何 `SSR` 的痕迹，就想在编写 `SPA` 应用一样。

## Installation

```sh
yarn add vue-ssr-prefetcher
```

Or use `npm`:

```sh
npm install vue-ssr-prefetcher --save
```

## Usage

`vue-ssr-prefetcher` 提供了两个 `vue` 插件：`serverPlugin` 和 `clientPlugin`，分别用于 `server entry` 和 `client entry`。

### 在 `server entry` 中：

```js
import Vue from 'vue'
import createApp from './createApp'
// 1. 引入 serverPlugin
import { serverPlugin } from 'vue-ssr-prefetcher'

// 2. 安装插件
Vue.use(serverPlugin)

export default async context => {
  const { app, router, store } = createApp()

  router.push(context.url)

  await routerReady(router)

  // 3. 设置 context.rendered 为 serverPlugin.done
  context.rendered = serverPlugin.done

  // 4. app.$$selfStore 是 serverPlugin 插件注入的属性
  context.state = {
    $$stroe: store ? store.state : undefined,
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

`serverPlugin` 会在根组件实例上注入 `app.$$selfStore` 属性，存储着组件级别的数据，你只需要将他添加到 `context.state` 中即可。另外，你还需要将 `context.rendered` 设置为 `serverPlugin.done`。

### 在 `client entry` 中：

```js
import Vue from 'vue'
import createApp from './createApp'
// 1. 引入插件
import { clientPlugin } from 'vue-ssr-prefetcher'
// 2. 安装插件
Vue.use(clientPlugin)

const { app, router, store } = createApp()

router.onReady(() => {
  // 3. 从 window.__INITIAL_STATE__ 中解构出 $$selfStore
  const { $$selfStore } = window.__INITIAL_STATE__

  // 4. 将数据添加到跟组件实例
  if ($$selfStore) app.$$selfStore = $$selfStore

  app.$mount('#app')
  // 5. 这个非常重要，它用于避免重复获取数据，并且一定要在 $mount() 函数之后
  clientPlugin.$$resolved = true
})
```

### 来看看接下来如何做数据预取

按照上面的介绍配置完成后，你就可以在任何组件的 `created` 钩子中发送请求预取数据：

```js
export default {
  name: 'Example',
  data() {
    return { name: 'Hcy' }
  },
  async created() {

    // this.$createFetcher() 函数是 clientPlugin 注入的
    // 接收一个返回 promise 的函数作为参数，例如用于请求 api 函数
    const fetcher = this.$createFetcher(fetchName)

    const res = await fetcher()

    this.name = res.name
  }
}
```

如上代码所示，和过去唯一不同的就是你需要调用 `this.$createFetcher` 函数创建一个 `fetcher`，实际上 `this.$createFetcher` 做的事情很简单，下面是它的源码：

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

仅仅是一个简单的包装，因此我们可以把通过 `this.$createFetcher` 函数创建得到的 `fetcher` 认为与原函数相同。

虽然看上去和开发 `SPA` 应用时没什么不同，但 `vue-ssr-prefetcher` 为你做了很多事情，让我们来对比一下：

|            | 能否访问 `this` | 能否用于任意组件  | 能否既用于服务端又用于客户端     | 能否预取组件级别的数据    |
| ---------- | :-----------:  | :-----------: | :-----------: | :-----------: |
| `nuxt/ream` 的 `asyncData`   | ❌           | ❌     | ✅       | ✅     |
| `Vue` 原生的 `serverPrefetch` | ✅           | ✅     | ❌       | ❌     |
| `vue-ssr-prefetcher`         | ✅           | ✅     | ✅       | ✅     |

当然了 `vue-ssr-prefetcher` 还为你做了：

- 避免重复获取数据
- 当路由跳转时应该能够正常发送请求

而你几乎什么都不需要做，**唯一需要做的就是使用 `this.$createFetcher` 函数创建 `fetcher`**，但这真的很直率，没有黑科技。

为了配合 `vuex` 一块使用，你只需要：

```js
export default {
  name: 'Example',
  async created() {
    const fetcher = this.$createFetcher(() => this.$store.dispatch('someAction'))

    fetcher()
  }
}
```