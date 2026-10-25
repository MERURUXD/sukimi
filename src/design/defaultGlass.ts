/** 只影响未保存过玻璃档位的设备；用户手选的材质始终优先。 */
export const defaultGlass = (cores?: number) => cores != null && cores > 0 && cores <= 2 ? 'frosted' : 'refract'
