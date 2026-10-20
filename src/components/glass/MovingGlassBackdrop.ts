import { createContext } from 'react'

/** 动态封面背景上保留透镜边缘，只用一次位移，避免逐帧分三通道采样。 */
export const MovingGlassBackdrop = createContext(false)
