# TypePractice 样式风格规范

> 参照 MonkeyType 极简风格

## 设计风格

深色极简，专注内容，无多余装饰。参照 MonkeyType 的沉浸式打字体验。

## 色彩

CSS 变量定义，便于主题切换：

| 变量 | 色值 | 用途 |
|------|------|------|
| `--bg-color` | `#323437` | 页面背景 |
| `--main-color` | `#e2b714` | 主强调色、正确光标 |
| `--sub-color` | `#646669` | 辅助文字、未输入字符 |
| `--sub-alt-color` | `#2c2e31` | 次级背景（导航、面板） |
| `--text-color` | `#d1d0c5` | 主文字、已输入正确字符 |
| `--error-color` | `#ca4754` | 错误字符 |
| `--error-extra-color` | `#7e2a33` | 多余字符 |
| `--caret-color` | `#e2b714` | 光标颜色 |

## 字体

```css
font-family: 'Roboto Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
```

| 场景 | 字号 |
|------|------|
| 练习字符 | `1.5rem` |
| 导航/标签 | `1rem` |
| 统计数值 | `2rem` |
| 统计标签 | `0.75rem` |

## 光标

- 样式：竖线 `2px` 宽，高度与字符等高
- 颜色：`var(--caret-color)`
- 闪烁：`caretFlashSmooth` 动画，1s 循环
- 移动：`transition` 平滑过渡 `left/top`，100ms ease-out
- 输入时停止闪烁，显示实心；空闲时恢复闪烁

## 布局

- 页面最大宽度 `1000px`，水平居中
- 顶部导航：左侧 Logo，右侧功能链接
- 练习区：垂直居中，`white-space: pre-wrap`
- 统计面板：练习区上方，水平排列

## 圆角与阴影

- 圆角：`0.5rem`
- 无阴影，纯色块区分层次

## 交互

- 点击任意位置聚焦输入
- 输入正确：字符变 `--text-color`，光标右移
- 输入错误：字符变 `--error-color`，阻止前进
- 特殊字符：换行 `↵`、Tab `→`、空格下划线标记
