# 第三方代码与许可

## React Bits / GlassSurface

`src/components/glass/refract.tsx` 的初始滤镜结构参考了 [React Bits 的 GlassSurface](https://github.com/DavidHDev/react-bits)。位移图与参数已重写，仍保留来源与许可说明。

- 作者：David Haz。
- 上游许可：MIT + Commons Clause License Condition v1.0。
- 许可原文：[public/third-party-notices.txt](public/third-party-notices.txt)，随正式构建一同发布。

## 包管理器依赖

依赖的许可由各自的软件包提供。`pnpm build` 会将实际打包依赖的许可汇总到 `dist/dependency-licenses.md`，随构建产物发布；以上说明不替代依赖包自己的许可。

Sukimi 自身代码尚未选择项目许可证。第三方许可不代表 Sukimi 整个项目采用相同许可证。
