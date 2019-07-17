import Vue from 'vue'

declare module 'vue/types/vue' {
  interface Vue {
    $$promises: Promise<any>[]
    _uid: number
    $$uid: number
    $$selfStore: {
      [key: number]: object
    }
  }
}
