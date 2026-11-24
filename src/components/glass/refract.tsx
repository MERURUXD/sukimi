/*
 * 液态折射：backdrop-filter: url(#svg) + feDisplacementMap（仅 Chromium 生效）。
 *
 * 位移图与动态形变共用 @sessile/core 的 Snell 光学 LUT 与 9-slice 切片引擎：
 * - 单圆角矩形优先走 8 块缓存切片（4 个角 + 4 条 1px 边条）与中性灰（128,128）中心兜底，
 *   resize 时仅改切片几何坐标而不重复编码 PNG；
 * - 极小尺寸或奇数胶囊退回整张 Stored-PNG，始终保持与 MorphRefractFilter 一致的折射曲线与位移量；
 * - 色散先把输入拆为单色光，再分别沿透镜位移，最后用加法还原 RGB，并在强为零时钳位为零。
 */
import { Fragment, useLayoutEffect, useRef, type RefObject } from 'react'
import {
  DEFAULT_REFRACTION_IOR,
  createRefractMapBuilder,
  resolveRefractTiles,
  type GlassFieldState,
  type RefractMapBuilder,
  type RefractionProfileSpec,
} from '@sessile/core'
import {
  SVG_NS,
  computeAutoBezel,
  resolveEffectiveMapScale,
  supportsSvgBackdropRefraction,
} from '@sessile/dom'

export interface LensOptions {
  bezel: number
  strength: number
  dispersion: number
  scaleMultiplier?: number
  profile?: RefractionProfileSpec
  ior?: number
  caustics?: boolean
}

const TILE_ORDER = ['top', 'bottom', 'left', 'right', 'tl', 'tr', 'bl', 'br'] as const
type TileName = (typeof TILE_ORDER)[number]

interface TileNode {
  image: Element
  mergeNode: Element
}

/** backdrop-filter: url(#svg) 目前只有 Chromium 真正生效 */
export function supportsRefract(): boolean {
  return supportsSvgBackdropRefraction()
}

export const autoBezel = computeAutoBezel

function isNearInt(v: number): boolean {
  return Math.abs(v - Math.round(v)) < 1e-3
}

function formatSvgCoord(v: number): string {
  return Math.abs(v - Math.round(v)) < 1e-4 ? String(Math.round(v)) : v.toFixed(3)
}

function setElementRect(el: Element, x: number, y: number, w: number, h: number): void {
  el.setAttribute('x', formatSvgCoord(x))
  el.setAttribute('y', formatSvgCoord(y))
  el.setAttribute('width', formatSvgCoord(w))
  el.setAttribute('height', formatSvgCoord(h))
}

/** 读取宿主元素的布局边框盒尺寸（保留小数像素，不受 transform 缩放影响） */
function measureBorderBox(el: HTMLElement, entry?: ResizeObserverEntry): [number, number] {
  const box = entry?.borderBoxSize?.[0]
  if (box && box.inlineSize > 0 && box.blockSize > 0) {
    return [box.inlineSize, box.blockSize]
  }
  const style = getComputedStyle(el)
  const rawW = parseFloat(style.width)
  const rawH = parseFloat(style.height)
  if (rawW > 0 && rawH > 0) {
    if (style.boxSizing === 'border-box') return [rawW, rawH]
    const px =
      (parseFloat(style.paddingLeft) || 0) +
      (parseFloat(style.paddingRight) || 0) +
      (parseFloat(style.borderLeftWidth) || 0) +
      (parseFloat(style.borderRightWidth) || 0)
    const py =
      (parseFloat(style.paddingTop) || 0) +
      (parseFloat(style.paddingBottom) || 0)
      + (parseFloat(style.borderTopWidth) || 0)
      + (parseFloat(style.borderBottomWidth) || 0)
    return [rawW + px, rawH + py]
  }
  return [el.offsetWidth, el.offsetHeight]
}

/** 跟随宿主元素尺寸更新 Snell 位移切片或整图，并同步 feDisplacementMap 的位移倍率 */
export function useLensMap(
  host: RefObject<HTMLElement | null>,
  enabled: boolean,
  o: LensOptions,
): RefObject<SVGFilterElement | null> {
  const filterRef = useRef<SVGFilterElement>(null)
  const profile = o.profile ?? 'squircle'
  const ior = o.ior !== undefined && Number.isFinite(o.ior) ? Math.max(1, o.ior) : DEFAULT_REFRACTION_IOR
  const caustics = Boolean(o.caustics)
  const scaleMultiplier =
    o.scaleMultiplier !== undefined && Number.isFinite(o.scaleMultiplier) && o.scaleMultiplier >= 0
      ? o.scaleMultiplier
      : 1
  const dispersive = o.dispersion > 0

  useLayoutEffect(() => {
    const el = host.current
    const filter = filterRef.current
    if (!enabled || !el || !filter) return
    const mergeEl = filter.querySelector('[data-lens-merge]')
    if (!mergeEl) return
    const doc = filter.ownerDocument

    const createTileNode = (name: string): TileNode => {
      const image = doc.createElementNS(SVG_NS, 'feImage')
      image.setAttribute('data-tile', name)
      image.setAttribute('preserveAspectRatio', 'none')
      image.setAttribute('result', `lens-${name}`)
      const mergeNode = doc.createElementNS(SVG_NS, 'feMergeNode')
      mergeNode.setAttribute('in', `lens-${name}`)
      return { image, mergeNode }
    }

    let tileNodes: Record<TileName, TileNode> | null = null
    let fullNode: TileNode | null = null
    let mapBuilder: RefractMapBuilder | null = null
    const attachedImages: Element[] = []
    const attachedMergeNodes: Element[] = []
    let activeMode: 'none' | 'nine-slice' | 'full' = 'none'
    let activeMask = -1
    let prevTileKey = ''
    let prevGeomKey = ''
    let prevFullHref = ''
    let prevFullGeomKey = ''
    let lastSize = ''

    const clearAttached = () => {
      for (let i = 0; i < attachedImages.length; i++) {
        const node = attachedImages[i]!
        if (node.parentNode) node.parentNode.removeChild(node)
      }
      for (let i = 0; i < attachedMergeNodes.length; i++) {
        const node = attachedMergeNodes[i]!
        if (node.parentNode) node.parentNode.removeChild(node)
      }
      attachedImages.length = 0
      attachedMergeNodes.length = 0
    }

    const attachNode = (node: TileNode) => {
      filter.insertBefore(node.image, mergeEl)
      attachedImages.push(node.image)
      mergeEl.appendChild(node.mergeNode)
      attachedMergeNodes.push(node.mergeNode)
    }

    const ensureNineSlice = (mask: number): Record<TileName, TileNode> => {
      if (!tileNodes) {
        tileNodes = {
          top: createTileNode('top'),
          bottom: createTileNode('bottom'),
          left: createTileNode('left'),
          right: createTileNode('right'),
          tl: createTileNode('tl'),
          tr: createTileNode('tr'),
          bl: createTileNode('bl'),
          br: createTileNode('br'),
        }
      }
      if (activeMode !== 'nine-slice' || activeMask !== mask) {
        clearAttached()
        activeMode = 'nine-slice'
        activeMask = mask
        prevTileKey = ''
        prevGeomKey = ''
        // 严格按底边条 -> 竖边条 -> 四角顺序合成，让四角盖住边条重叠区。
        if ((mask & 1) !== 0) {
          attachNode(tileNodes.top)
          attachNode(tileNodes.bottom)
        }
        if ((mask & 2) !== 0) {
          attachNode(tileNodes.left)
          attachNode(tileNodes.right)
        }
        attachNode(tileNodes.tl)
        attachNode(tileNodes.tr)
        attachNode(tileNodes.bl)
        attachNode(tileNodes.br)
      }
      return tileNodes
    }

    const ensureFullNode = (): TileNode => {
      fullNode ??= createTileNode('full')
      if (activeMode !== 'full') {
        clearAttached()
        activeMode = 'full'
        activeMask = -1
        prevFullHref = ''
        prevFullGeomKey = ''
        mapBuilder?.reset()
        attachNode(fullNode)
      }
      return fullNode
    }

    const draw = (entry?: ResizeObserverEntry) => {
      if (!el.offsetWidth || !el.offsetHeight) return
      // offsetWidth/Height 会把 .01–.49 的小数宽度向下取整，导致位移图右/下边缘短缺半像素并露出色散伪色；
      // 取真实布局边框盒后向上取整（减去极小浮点容差避免整像素误进位），始终完全覆盖宿主区域。
      const [rawW, rawH] = measureBorderBox(el, entry)
      const w = Math.max(1, Math.ceil(rawW - 1e-4))
      const h = Math.max(1, Math.ceil(rawH - 1e-4))
      // 动画中会改内联圆角的玻璃（Popover 展开）用 data-lens-radius 固定落定后的圆角
      const radius = Number(el.dataset.lensRadius) || parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0
      const minHalf = Math.min(w, h) * 0.5
      const rad = Math.max(0, Math.min(radius, minHalf))
      const frameBezel = o.bezel > 0 ? Math.max(1, Math.min(o.bezel, minHalf)) : computeAutoBezel(w, h)
      const effBezel = Math.max(1e-3, Math.min(frameBezel, minHalf))
      const sizeKey = `${w}:${h}:${rad.toFixed(3)}:${effBezel.toFixed(3)}`
      if (lastSize === sizeKey) return
      lastSize = sizeKey

      const slice = Math.min(Math.ceil(Math.max(rad, effBezel)), minHalf)
      const span = w - 2 * slice
      const rise = h - 2 * slice
      const canNineSlice =
        w >= 4 &&
        h >= 4 &&
        slice >= 2 &&
        (span > 1e-3 || isNearInt(slice)) &&
        (rise > 1e-3 || isNearInt(slice))

      let maxDisplacementPx = 0
      if (canNineSlice) {
        const tiles = resolveRefractTiles({
          radius: rad,
          bezel: effBezel,
          slice,
          profile,
          ior,
          thicknessRatio: o.strength,
          caustics,
        })
        const hasHStrips = span > 1e-3
        const hasVStrips = rise > 1e-3
        const mask = (hasHStrips ? 1 : 0) | (hasVStrips ? 2 : 0)
        const nodes = ensureNineSlice(mask)

        if (tiles.key !== prevTileKey) {
          for (let i = 0; i < TILE_ORDER.length; i++) {
            const name = TILE_ORDER[i]!
            nodes[name].image.setAttribute('href', tiles[name])
          }
          prevTileKey = tiles.key
        }

        const geomKey = `${w}:${h}:${formatSvgCoord(slice)}:${mask}`
        if (geomKey !== prevGeomKey) {
          const pad = Math.min(1, slice * 0.25)
          if (hasHStrips) {
            setElementRect(nodes.top.image, slice - pad, 0, span + 2 * pad, slice)
            setElementRect(nodes.bottom.image, slice - pad, h - slice, span + 2 * pad, slice)
          }
          if (hasVStrips) {
            setElementRect(nodes.left.image, 0, slice - pad, slice, rise + 2 * pad)
            setElementRect(nodes.right.image, w - slice, slice - pad, slice, rise + 2 * pad)
          }
          setElementRect(nodes.tl.image, 0, 0, slice, slice)
          setElementRect(nodes.tr.image, w - slice, 0, slice, slice)
          setElementRect(nodes.bl.image, 0, h - slice, slice, slice)
          setElementRect(nodes.br.image, w - slice, h - slice, slice, slice)
          prevGeomKey = geomKey
        }
        maxDisplacementPx = tiles.maxDisplacementPx
      } else {
        const node = ensureFullNode()
        mapBuilder ??= createRefractMapBuilder()
        const field: GlassFieldState = {
          primitives: [
            {
              id: 'glass',
              center: { x: w * 0.5, y: h * 0.5 },
              size: { width: w, height: h },
              radius: rad,
            },
          ],
          blendK: 0,
        }
        const map = mapBuilder.build({
          bounds: { x: 0, y: 0, width: w, height: h },
          field,
          bezel: effBezel,
          mapScale: resolveEffectiveMapScale(w, h, 0.5),
          profile,
          ior,
          thicknessRatio: o.strength,
          caustics,
        })
        if (map.dataUrl !== prevFullHref) {
          node.image.setAttribute('href', map.dataUrl)
          prevFullHref = map.dataUrl
        }
        const fullGeomKey = `${w}:${h}`
        if (fullGeomKey !== prevFullGeomKey) {
          setElementRect(node.image, 0, 0, w, h)
          prevFullGeomKey = fullGeomKey
        }
        maxDisplacementPx = map.maxDisplacementPx
      }

      // 与 @sessile/dom refractFilter 保持完全一致的 Snell 位移倍率和零强度色散钳位：
      // 位移图 ±127 对应 ±scale/2，所以 baseScale = 2 × 最大位移像素 × scaleMultiplier。
      const baseScale = Math.max(0, 2 * maxDisplacementPx * scaleMultiplier)
      const effectiveDispersion = baseScale > 0 ? Math.min(o.dispersion, baseScale * 0.5) : 0
      filter.querySelectorAll('[data-extra]').forEach((fe) => {
        const extraRaw = Number((fe as SVGElement).dataset?.extra ?? fe.getAttribute('data-extra') ?? 0)
        const sign = Math.sign(extraRaw)
        const channelScale = Math.max(0, baseScale + sign * effectiveDispersion)
        fe.setAttribute('scale', String(channelScale))
      })
    }

    draw()
    // 在本次布局绘制前同步换图；延迟或再等一帧会先拉伸旧透镜带，随后边缘二次跳变。
    const ro = new ResizeObserver((entries) => draw(entries?.[0]))
    ro.observe(el)
    return () => {
      ro.disconnect()
      clearAttached()
    }
  }, [enabled, o.bezel, o.strength, o.dispersion, scaleMultiplier, dispersive, profile, ior, caustics])

  return filterRef
}

export function LensFilter({
  id,
  filterRef,
  dispersion,
}: {
  id: string
  filterRef: RefObject<SVGFilterElement | null>
  dispersion: number
}) {
  const dispersive = dispersion > 0
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 -z-10 size-full opacity-0">
      <defs>
        <filter
          key={dispersive ? 'rgb' : 'mono'}
          ref={filterRef}
          id={id}
          colorInterpolationFilters="sRGB"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
        >
          {/* 位移图外的透明黑 (0,0) 会触发最大负位移并产生红橙伪色；用中性灰 (128,128) 兜底保持零位移。 */}
          <feFlood floodColor="rgb(128,128,128)" result="neutral" />
          <feMerge data-lens-merge="" result="map">
            <feMergeNode in="neutral" />
          </feMerge>
          {dispersive ? (
            <>
              {(['R', 'G', 'B'] as const).map((channel, index) => (
                <Fragment key={channel}>
                  <feComponentTransfer in="SourceGraphic" result={`input-${channel}`}>
                    <feFuncR type="linear" slope={channel === 'R' ? 1 : 0} />
                    <feFuncG type="linear" slope={channel === 'G' ? 1 : 0} />
                    <feFuncB type="linear" slope={channel === 'B' ? 1 : 0} />
                  </feComponentTransfer>
                  <feDisplacementMap
                    in={`input-${channel}`}
                    in2="map"
                    xChannelSelector="R"
                    yChannelSelector="G"
                    scale="0"
                    data-extra={(index - 1) * dispersion}
                    result={`lens-${channel}`}
                  />
                </Fragment>
              ))}
              {/* 单色通道互不重叠，加法合成不会把封面的颜色混成新的色调。 */}
              <feComposite in="lens-R" in2="lens-G" operator="arithmetic" k2={1} k3={1} result="red-green" />
              <feComposite in="red-green" in2="lens-B" operator="arithmetic" k2={1} k3={1} />
            </>
          ) : (
            <feDisplacementMap
              data-extra={0}
              scale="0"
              in="SourceGraphic"
              in2="map"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          )}
        </filter>
      </defs>
    </svg>
  )
}
