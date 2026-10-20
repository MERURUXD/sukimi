import { createContext } from 'react'

/** 动态背景用一次位移；持续运动或切屏期间用 suspend 暂停折射。 */
export const MovingGlassBackdrop = createContext<boolean | 'suspend'>(false)
