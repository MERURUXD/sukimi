/**
 * 形变期间 Route B3 折射滤镜的 React 外壳。SVG 滤镜图（位移图、背景模糊、色彩矩阵、RGB 色散、
 * 按位移图 alpha 自遮罩）由 @sessile/dom 的控制器建在 body 下；这里只负责随组件挂载和卸载
 * 创建、销毁控制器，并同步玻璃档位参数。逐帧更新走命令式句柄，不经过 React 渲染。
 *
 * SPDX-License-Identifier: MPL-2.0
 */

import {
  createRefractFilterController,
  type RefractFilterConfig,
  type RefractFilterController,
  type RefractFilterFrame,
} from '@sessile/dom'
import { useImperativeHandle, useLayoutEffect, useRef, type Ref } from 'react'

export interface MorphRefractFilterHandle {
  updateFrame: (frame: RefractFilterFrame) => void
}

export function MorphRefractFilter({
  id,
  bezel,
  strength,
  dispersion,
  scaleMultiplier,
  profile,
  ior,
  caustics,
  ref,
}: {
  id: string
  bezel: number
  strength: number
  dispersion: number
  scaleMultiplier?: number
  profile?: RefractFilterConfig['profile']
  ior?: number
  caustics?: boolean
  ref?: Ref<MorphRefractFilterHandle>
}) {
  const controllerRef = useRef<RefractFilterController | null>(null)
  // 由下面的同步副作用更新，换 id 重建控制器时拿到的是上一次提交的档位参数
  const configRef = useRef({ bezel, strength, dispersion, scaleMultiplier, profile, ior, caustics })

  useLayoutEffect(() => {
    const controller = createRefractFilterController({ id, ...configRef.current })
    controller.mount()
    controllerRef.current = controller
    return () => {
      controller.dispose()
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }, [id])

  useLayoutEffect(() => {
    configRef.current = { bezel, strength, dispersion, scaleMultiplier, profile, ior, caustics }
    controllerRef.current?.updateConfig(configRef.current)
  }, [bezel, strength, dispersion, scaleMultiplier, profile, ior, caustics])

  useImperativeHandle(ref, () => ({ updateFrame: (frame) => controllerRef.current?.updateFrame(frame) }), [])

  return null
}
