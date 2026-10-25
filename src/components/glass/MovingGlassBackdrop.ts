import { createContext } from 'react'

/** 动态背景用一次位移；全程运动的放映层用 suspend 暂停折射。 */
export const MovingGlassBackdrop = createContext<boolean | 'suspend'>(false)
