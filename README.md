# 央视视频下载工具

纯静态 GitHub Pages 网页。粘贴央视网视频页面，默认选择播放清单中分辨率最高、同分辨率下码率最高的流，在浏览器 Worker 中逐片处理 h5e 数据，再无损封装为 MP4。无需后端或账户。

网页：https://ahh20250507.github.io/cctv-video-downloader/

## 使用

1. 粘贴 `https://tv.cctv.com/.../VIDE....shtml` 视频页，或 32 位 GUID。
2. 点击解析；画质默认选择源站最高档，不虚构 1080p / 4K。
3. 点击下载 MP4，处理完成后自动触发浏览器下载；预览和「重新下载」仅作为备用。

支持央视网公开点播的 H.264 + AAC / h5e 码流。不支持独立央视频 App / yangshipin.cn、直播、付费或登录受限内容。没有 h5e 流或遇到不支持的播放清单会明确报错，不直接拼接产生花屏文件。

内存模式保护上限 800 MB。长视频请使用桌面工具；Chrome / Edge 电脑端推荐。文件与链接不写入本地存储，也不上传到第三方代理；浏览器直接请求央视元数据 / CDN。解析使用央视 JSONP 接口，因此需要信任央视域名返回的脚本。源站的格式、接口、跨域策略变化都可能造成失效。

## 实测

样例：`https://tv.cctv.com/2026/11/05/VIDEW9nYaP9C5dIzPQWfIYEV261105.shtml?spm=C53156045404.PKXC0xLPAnP9.0.0`

- 实际最高：1280×720，播放清单 BANDWIDTH=2048000。
- MP4：117585249 字节，470.952 秒，H.264 + AAC。
- 真实 Edge 浏览器完成整片下载、处理、预览解码。
- `ffmpeg -v error -xerror -err_detect explode -i artifacts/test-video.mp4 -map 0:v -map 0:a -f null -` 全片严格解码，退出码 0，无错误输出。
- 网页自身只做首帧解码、轨道 / 时长 / 分辨率检查，不声称逐帧验证所有视频。

## 开发

Node.js 24+，Python 3（本地静态服务器）。

```sh
npm ci
npm test
npm run build
python -m http.server 8768
node tests/browser.mjs
```

`tests/browser.mjs` 需要本机 Edge，可用 `TEST_URL` 指定部署地址；会实际下载测试片，并把验证文件写入未提交的 `artifacts/`。

## 花屏修复

直接抓取 enc / h5e / enc2 流，普通下载器不能保证输出可解码内容。这里只处理匹配的 h5e 流，再生成 MP4。

测试还定位到上游 TS 重打包中的缺陷：NAL 长度缩短而首次新增 adaptation field 时，没有同步设置 TS 包头 `hasAdaptationControl`。这会使播放器把填充区当成视频数据，造成少量尾行解码错误。本项目在 `vendor/h5e/decrypter.ts` 补齐该标记，并加入不依赖线上视频的回归测试。

## Windows 属性时长

mux.js 的初始分段 MP4 元数据使用 `0xffffffff` 表示未知时长。Windows Shell 将其按 90000 的时间基准显示为约 13:15:21，尽管播放器通过扫描分片能得到真实时长。`src/mp4-duration.mjs` 在视频完成后，按各自时间基准更新 mvhd、tkhd、mdhd 的固定长度时长字段，不改变媒体数据或分片偏移。`python tests/windows-duration.py artifacts/test-video.mp4` 会验证 5 个字段及 Windows Shell 实际读取结果（测试片为 470.952 秒）。

## 来源与许可

- h5e 处理：xiaoxi-ij478/cctv-h5e-decrypt，提交 `033b487971673a2dc02cbaf7b16f537a27c2f515`，上游 MIT，许可见 `vendor/H5E-LICENSE`。上游包含央视播放器适配模块，其来源见 `vendor/h5e/external/`。
- MP4 封装：mux.js 7.1.0，Apache-2.0，许可见 `vendor/MUX-LICENSE`。
- CRC：js-crc 0.3.1，MIT，许可见 `vendor/CRC-LICENSE`。

仅下载有权保存的内容，遵守源站条款和版权规定。本工具不解除账户、付费或地域访问限制。
