/*
 * 按用户分开存的 zustand persist 存储：真实键在每次读写时按「当前用户」解析（规则见 userScope.ts）。
 * 用户变化后 `rehydrateOnUserChange` 重新读取，当前用户没有存过的部分回到初始值，不会残留上一个人的偏好。
 */
import type { StoreApi } from 'zustand'
import { createJSONStorage, type PersistOptions } from 'zustand/middleware'
import { scopedKey } from '@/features/auth/userScope'
import { isDemo, isDevLab } from '@/lib/demo'
import { useAuth } from './auth'

// 虚构验收页（/dev/*）同样走 .demo 隔离键，不碰真实用户的偏好
const key = (name: string) => scopedKey(name, useAuth.getState().user?.id, isDemo || isDevLab)

export const userStorage = <S>() =>
  createJSONStorage<S>(() => ({
    getItem: (name) => {
      const k = key(name)
      return k ? localStorage.getItem(k) : null
    },
    setItem: (name, value) => {
      const k = key(name)
      if (k) localStorage.setItem(k, value)
    },
    removeItem: (name) => {
      const k = key(name)
      if (k) localStorage.removeItem(k)
    },
  }))!

/** 读到的存档盖在初始值上；没有存档（新用户、未登录）就是初始值，不沿用内存里上一个用户的数据 */
export const scopedMerge =
  <S>(initial: Partial<S>): PersistOptions<S>['merge'] =>
  (persisted, current) => ({ ...current, ...initial, ...(persisted as Partial<S> | undefined) })

type PersistedStore = StoreApi<unknown> & { persist: { rehydrate: () => void | Promise<void> } }

export function rehydrateOnUserChange(store: PersistedStore) {
  useAuth.subscribe((s, prev) => {
    if (s.user?.id !== prev.user?.id) void store.persist.rehydrate()
  })
}
