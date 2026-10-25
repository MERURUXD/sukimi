/*
 * 应用标志「兔耳书签」的图形数据（512 坐标），登录页的实心标志和分享海报用；顶栏是另画的简化描线版（都在 app/BrandMark.tsx）。
 * public/ 里的 favicon 和 PNG 图标、design/icons 里的源文件是同一套图形；改形状时一起重新导出。
 */

export const BRAND_EARS =
  'M149 207C123 168 105 103 116 51c4-21 12-31 23-27 36 11 67 100 65 174Zm146-13c-3-59 15-105 49-105 24-1 40 16 55 42l35 60c10 18 7 38-9 40-24 3-48-31-70-59-8 14-10 31-9 46Z'
export const BRAND_BODY = 'M103 222q0-50 50-50h206q50 0 50 50v228q0 26-24 12l-129-75-129 75q-24 14-24-12Z'
/** 耳朵内侧的粉色 */
export const BRAND_INNER =
  'M160 190C142 156 130 108 136 66C138 54 142 48 148 52C170 76 184 136 184 188ZM318 172C318 130 332 112 346 112C362 112 374 126 386 146L406 191C410 199 408 204 403 202C392 198 378 180 362 158C352 146 340 150 334 172Z'
/** 两只胶囊眼的中心；眼睛 25 × 67，向右斜 18° */
export const BRAND_EYES = [
  { cx: 216.5, cy: 300.5 },
  { cx: 295.5, cy: 300.5 },
] as const
export const BRAND_EYE = { w: 25, h: 67, tilt: 18 }
export const BRAND_BLUSH = [
  { cx: 184, cy: 354 },
  { cx: 330, cy: 354 },
] as const
export const BRAND_BLUSH_R = { x: 20, y: 11 }
/** 图形本身的中心，放进方块时以它对齐 */
export const BRAND_CENTER = { x: 268, y: 247 }

export const BRAND_LIGHT = '#F1ECE4'
export const BRAND_DARK = '#141416'
export const BRAND_PINK = '#EFB7AE'
